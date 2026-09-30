import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { newPublicId } from "../../utils/ids.js";
import {
  ADMIN_STATUS_TRANSITIONS,
  adminCanTransition,
} from "../order/orderStatusFlow.js";
import {
  decrementVariantOrProductStock,
  restoreVariantOrProductStock,
} from "../product/productVariantStock.js";
import { notifyOrderStatusChanged } from "../notify/orderNotify.service.js";

function shouldRestoreStockOnCancel(from: OrderStatus): boolean {
  return (
    from === OrderStatus.APPROVED ||
    from === OrderStatus.PAYMENT_PENDING ||
    from === OrderStatus.PAID
  );
}

/**
 * Decrements stock (variant-aware — see productVariantStock.ts) with an
 * atomic conditional UPDATE (WHERE stock >= qty in the same statement as the
 * decrement) instead of read-then-write, so two admins concurrently approving
 * orders against the same low-stock product/variant can't both pass a stale
 * stock check and oversell.
 */
async function applyStockDecrement(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<void> {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const line of items) {
    await decrementVariantOrProductStock(tx, {
      productId: line.productId,
      productVariantId: line.productVariantId,
      quantity: line.quantity,
    });
  }
}

async function applyStockRestore(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<void> {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const line of items) {
    await restoreVariantOrProductStock(tx, {
      productId: line.productId,
      productVariantId: line.productVariantId,
      quantity: line.quantity,
    });
  }
}

export async function adminUpdateOrderStatus(input: {
  publicId: string;
  nextStatus: OrderStatus;
  actorUserId: string;
  shipmentTrackingId?: string | null;
  courierName?: string | null;
  shipmentTrackingUrl?: string | null;
  paymentReference?: string | null;
  paymentStatus?: string | null;
}) {
  const order = await prisma.order.findUnique({
    where: { publicId: input.publicId },
    include: { items: true },
  });
  if (!order) {
    throw new AppError(404, "Order not found", "NOT_FOUND");
  }

  const from = order.status;
  const to = input.nextStatus;

  if (!adminCanTransition(from, to)) {
    throw new AppError(
      400,
      `Invalid status transition: ${from} → ${to}`,
      "INVALID_TRANSITION"
    );
  }

  if (to === OrderStatus.SHIPPED && from === OrderStatus.PAID) {
    if (!input.shipmentTrackingId?.trim()) {
      throw new AppError(
        400,
        "shipmentTrackingId is required to mark as SHIPPED",
        "TRACKING_REQUIRED"
      );
    }
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    if (to === OrderStatus.APPROVED && from === OrderStatus.PENDING_APPROVAL) {
      await applyStockDecrement(tx, order.id);
    }

    if (to === OrderStatus.CANCELLED && shouldRestoreStockOnCancel(from)) {
      await applyStockRestore(tx, order.id);
    }

    const data: Prisma.OrderUpdateInput = { status: to };

    if (input.shipmentTrackingId !== undefined) {
      data.shipmentTrackingId = input.shipmentTrackingId || null;
    }
    if (to === OrderStatus.SHIPPED && input.shipmentTrackingId) {
      data.shipmentTrackingId = input.shipmentTrackingId;
    }
    if (input.courierName !== undefined) {
      data.courierName = input.courierName?.trim() || null;
    }
    if (input.shipmentTrackingUrl !== undefined) {
      data.shipmentTrackingUrl = input.shipmentTrackingUrl?.trim() || null;
    }
    if (input.paymentReference !== undefined) {
      data.paymentReference = input.paymentReference || null;
    }
    if (input.paymentStatus !== undefined) {
      data.paymentStatus = input.paymentStatus || order.paymentStatus;
    }

    if (to === OrderStatus.PAID) {
      data.paymentStatus = input.paymentStatus ?? "paid";
    }
    if (to === OrderStatus.PAYMENT_PENDING) {
      data.paymentStatus = input.paymentStatus ?? "payment_pending";
    }
    if (to === OrderStatus.APPROVED) {
      data.paymentStatus = input.paymentStatus ?? "awaiting_payment";
    }
    if (to === OrderStatus.CANCELLED) {
      data.paymentStatus = input.paymentStatus ?? "cancelled";
    }

    if (to === OrderStatus.APPROVED) {
      data.approvedAt = now;
      if (!order.invoicePublicId) {
        data.invoicePublicId = newPublicId("inv");
        data.invoiceIssuedAt = now;
      }
    }
    if (to === OrderStatus.PAYMENT_PENDING) {
      data.paymentPendingAt = now;
    }
    if (to === OrderStatus.PAID) {
      data.paidAt = now;
      if (!order.receiptPublicId) {
        data.receiptPublicId = newPublicId("rcp");
        data.receiptIssuedAt = now;
      }
    }
    if (to === OrderStatus.SHIPPED) {
      data.shippedAt = now;
    }
    if (to === OrderStatus.OUT_FOR_DELIVERY) {
      data.outForDeliveryAt = now;
    }
    if (to === OrderStatus.DELIVERED) {
      data.deliveredAt = now;
    }
    if (to === OrderStatus.COMPLETED) {
      data.completedAt = now;
    }

    await tx.order.update({
      where: { id: order.id },
      data,
    });
  });

  await prisma.auditLog.create({
    data: {
      action: "admin.order.status",
      entityType: "order",
      entityId: input.publicId,
      userId: input.actorUserId,
      metadata: {
        from,
        to,
        shipmentTrackingId: input.shipmentTrackingId ?? undefined,
      } as object,
    },
  });

  // Fire-and-forget: notifyOrderStatusChanged never throws (see
  // orderNotify.service.ts), so this can't affect the admin response either
  // way — deliberately not awaited so a slow email/SMS provider never delays
  // the status-update API call.
  notifyOrderStatusChanged(input.publicId, from, to).catch(() => {});

  return prisma.order.findUnique({
    where: { publicId: input.publicId },
    include: {
      user: { select: { email: true, publicId: true } },
      items: true,
    },
  });
}

export async function adminListOrders(params: {
  page: number;
  limit: number;
  status?: OrderStatus;
  search?: string;
}) {
  const skip = (params.page - 1) * params.limit;
  const where: Prisma.OrderWhereInput = {};

  if (params.status) {
    where.status = params.status;
  }
  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [
      { publicId: { contains: q, mode: "insensitive" } },
      { contactEmail: { contains: q, mode: "insensitive" } },
      { user: { email: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: params.limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { email: true, publicId: true } },
        items: true,
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    items: rows.map((o) => ({
      publicId: o.publicId,
      status: o.status,
      total: Number(o.total).toFixed(2),
      paymentStatus: o.paymentStatus,
      paymentReference: o.paymentReference,
      shipmentTrackingId: o.shipmentTrackingId,
      courierName: o.courierName,
      userEmail: o.user.email,
      userPublicId: o.user.publicId,
      createdAt: o.createdAt,
      itemCount: o.items.length,
    })),
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
  };
}

export async function adminGetOrder(publicId: string) {
  const o = await prisma.order.findUnique({
    where: { publicId },
    include: {
      user: {
        select: {
          email: true,
          publicId: true,
          firstName: true,
          lastName: true,
        },
      },
      items: true,
    },
  });
  if (!o) {
    throw new AppError(404, "Order not found", "NOT_FOUND");
  }
  return {
    publicId: o.publicId,
    status: o.status,
    subtotal: Number(o.subtotal).toFixed(2),
    shippingTotal: Number(o.shippingTotal).toFixed(2),
    total: Number(o.total).toFixed(2),
    advancePercent: o.advancePercent,
    advanceAmount: Number(o.advanceAmount).toFixed(2),
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    paymentReference: o.paymentReference,
    shipmentTrackingId: o.shipmentTrackingId,
    courierName: o.courierName,
    shipmentTrackingUrl: o.shipmentTrackingUrl,
    invoicePublicId: o.invoicePublicId,
    invoiceIssuedAt: o.invoiceIssuedAt,
    receiptPublicId: o.receiptPublicId,
    receiptIssuedAt: o.receiptIssuedAt,
    approvedAt: o.approvedAt,
    paymentPendingAt: o.paymentPendingAt,
    paidAt: o.paidAt,
    shippedAt: o.shippedAt,
    outForDeliveryAt: o.outForDeliveryAt,
    deliveredAt: o.deliveredAt,
    completedAt: o.completedAt,
    shippingAddress: o.shippingAddress,
    contactEmail: o.contactEmail,
    contactPhone: o.contactPhone,
    notes: o.notes,
    createdAt: o.createdAt,
    user: o.user,
    items: o.items.map((i) => ({
      name: i.nameSnapshot,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice).toFixed(2),
      productId: i.productId,
    })),
    allowedNext: ADMIN_STATUS_TRANSITIONS[o.status],
  };
}
