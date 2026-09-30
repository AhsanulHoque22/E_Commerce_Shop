import { OrderStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { newPublicId } from "../../utils/ids.js";
import { orderAllowsGatewayPayment } from "../order/orderStatusFlow.js";

/**
 * Confirms a gateway-verified payment against an order and marks it PAID.
 * `gatewayRef` and `amount` must already be server-verified (e.g. via
 * SSLCommerz's Order Validation API) — this function does not re-check the
 * gateway itself, only that the amount matches what the order expects.
 *
 * Idempotent: an IPN can fire more than once for the same transaction (and
 * our success-redirect handler may also race the IPN for the same order).
 * A call against an already-PAID order is a safe no-op — `alreadyPaid: true`
 * — never a duplicate charge or a thrown error.
 */
export async function markOrderPaidFromGateway(
  orderPublicId: string,
  gatewayRef: string,
  amount: number
): Promise<{ alreadyPaid: boolean }> {
  const order = await prisma.order.findUnique({ where: { publicId: orderPublicId } });
  if (!order) {
    throw new AppError(404, "Order not found", "NOT_FOUND");
  }

  if (order.status === OrderStatus.PAID) {
    return { alreadyPaid: true };
  }
  if (!orderAllowsGatewayPayment(order.status)) {
    throw new AppError(
      409,
      `Order is not awaiting payment (status: ${order.status})`,
      "INVALID_ORDER_STATE"
    );
  }

  const expected = Number(order.advanceAmount);
  if (Math.abs(expected - amount) > 0.01) {
    throw new AppError(
      409,
      `Paid amount (${amount}) does not match the expected amount (${expected})`,
      "AMOUNT_MISMATCH"
    );
  }

  const now = new Date();
  const alreadyPaid = await prisma.$transaction(async (tx) => {
    // Atomic conditional UPDATE (status IN [...] in the same statement as
    // the write) closes the race between two concurrent webhook deliveries
    // for the same order — same pattern as adminOrder.service.ts's stock
    // decrement guard.
    const result = await tx.order.updateMany({
      where: { id: order.id, status: { in: [OrderStatus.APPROVED, OrderStatus.PAYMENT_PENDING] } },
      data: {
        status: OrderStatus.PAID,
        paymentMethod: "sslcommerz",
        paymentStatus: "paid",
        paymentReference: gatewayRef,
        paidAt: now,
      },
    });

    if (result.count === 0) {
      // Lost the race (or the order moved on since we read it above).
      const fresh = await tx.order.findUnique({ where: { id: order.id } });
      if (fresh?.status === OrderStatus.PAID) {
        return true;
      }
      throw new AppError(
        409,
        `Order is not awaiting payment (status: ${fresh?.status ?? "unknown"})`,
        "INVALID_ORDER_STATE"
      );
    }

    // Same shape as adminOrder.service.ts's PAID branch — issue a receipt
    // reference if one isn't already set. No stock touched here; payment
    // confirmation doesn't decrement or restore inventory.
    await tx.order.updateMany({
      where: { id: order.id, receiptPublicId: null },
      data: { receiptPublicId: newPublicId("rcp"), receiptIssuedAt: now },
    });

    return false;
  });

  return { alreadyPaid };
}
