import type { Request, Response } from "express";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { parseBody } from "../utils/validate.js";
import { sendSuccess } from "../utils/response.js";
import { paramString } from "../utils/routeParams.js";
import { initiatePaymentSchema, gatewayCallbackSchema } from "../schemas/payment.schema.js";
import { createPaymentSession, verifyPaymentByValId } from "../services/payment/sslcommerz.service.js";
import { markOrderPaidFromGateway } from "../services/payment/orderPayment.service.js";
import { orderAllowsGatewayPayment } from "../services/order/orderStatusFlow.js";

function callbackBaseUrl(req: Request): string {
  return `${req.protocol}://${req.get("host")}`;
}

export async function initiate(req: Request, res: Response): Promise<void> {
  parseBody(initiatePaymentSchema, req.body ?? {});
  const publicId = paramString(req.params.orderPublicId);

  const order = await prisma.order.findUnique({ where: { publicId } });
  if (!order || order.userId !== req.user!.id) {
    throw new AppError(404, "Order not found", "NOT_FOUND");
  }
  if (!orderAllowsGatewayPayment(order.status)) {
    throw new AppError(
      409,
      `Order is not awaiting payment (status: ${order.status})`,
      "INVALID_ORDER_STATE"
    );
  }

  const base = callbackBaseUrl(req);
  const shipping = order.shippingAddress as {
    fullName?: string;
    line1?: string;
    city?: string;
  } | null;

  const redirectUrl = await createPaymentSession({
    tranId: order.publicId,
    amount: Number(order.advanceAmount),
    currency: order.currency,
    successUrl: `${base}/api/payment/success`,
    failUrl: `${base}/api/payment/fail`,
    cancelUrl: `${base}/api/payment/cancel`,
    ipnUrl: `${base}/api/payment/ipn`,
    customerName: shipping?.fullName || order.contactEmail,
    customerEmail: order.contactEmail,
    customerPhone: order.contactPhone || "N/A",
    customerAddress: shipping?.line1 || "N/A",
    customerCity: shipping?.city || "Dhaka",
  });

  sendSuccess(res, { redirectUrl });
}

/**
 * Shared confirmation path for both the IPN endpoint and the success
 * redirect (SSLCommerz can deliver either or both for the same transaction).
 * Never trusts the callback body's own status/amount — always re-verifies
 * server-to-server via the Order Validation API before touching the order.
 */
async function confirmFromCallback(
  body: unknown
): Promise<{ orderPublicId: string; paid: boolean }> {
  const parsed = parseBody(gatewayCallbackSchema, body);
  const orderPublicId = parsed.tran_id;

  if (!parsed.val_id) {
    // FAILED / CANCELLED / EXPIRED postbacks carry no val_id — nothing to verify.
    return { orderPublicId, paid: false };
  }

  const verified = await verifyPaymentByValId(parsed.val_id);
  if (verified.tranId !== orderPublicId) {
    throw new AppError(400, "Transaction ID mismatch on payment verification", "TRAN_ID_MISMATCH");
  }

  await markOrderPaidFromGateway(orderPublicId, verified.valId, verified.amount);
  return { orderPublicId, paid: true };
}

/** Public, no auth — SSLCommerz calls this server-to-server. */
export async function ipn(req: Request, res: Response): Promise<void> {
  const result = await confirmFromCallback(req.body);
  sendSuccess(res, result);
}

function redirectToClient(
  res: Response,
  orderPublicId: string,
  status: "success" | "fail" | "cancel"
): void {
  const clientOrigin = env.CLIENT_ORIGIN.split(",")[0]?.trim() || "/";
  const suffix = orderPublicId ? `/orders/${orderPublicId}?payment=${status}` : `/?payment=${status}`;
  res.redirect(303, `${clientOrigin}${suffix}`);
}

/** SSLCommerz redirects the customer's browser here (POST) after a successful charge. */
export async function success(req: Request, res: Response): Promise<void> {
  try {
    const result = await confirmFromCallback(req.body);
    redirectToClient(res, result.orderPublicId, result.paid ? "success" : "fail");
  } catch {
    // This is a browser landing page, not an API caller — don't surface a raw
    // JSON error, just send the user to a failure page. The IPN endpoint is
    // the authoritative confirmation path; this is best-effort UX only.
    const publicId = typeof req.body?.tran_id === "string" ? req.body.tran_id : "";
    redirectToClient(res, publicId, "fail");
  }
}

export async function fail(req: Request, res: Response): Promise<void> {
  const publicId = typeof req.body?.tran_id === "string" ? req.body.tran_id : "";
  redirectToClient(res, publicId, "fail");
}

export async function cancel(req: Request, res: Response): Promise<void> {
  const publicId = typeof req.body?.tran_id === "string" ? req.body.tran_id : "";
  redirectToClient(res, publicId, "cancel");
}
