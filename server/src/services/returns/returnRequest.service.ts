import { OrderStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { newPublicId } from "../../utils/ids.js";

/** Customers may only request a return/exchange/warranty claim once the order has arrived. */
const RETURN_ELIGIBLE_STATUSES: OrderStatus[] = [OrderStatus.DELIVERED, OrderStatus.COMPLETED];
const OPEN_RETURN_STATUSES = ["requested", "approved"];
const RESOLVED_STATUSES = ["approved", "rejected", "completed"];

export type ReturnRequestType = "return" | "exchange" | "warranty";
export type ReturnRequestStatus = "requested" | "approved" | "rejected" | "completed";

export async function createReturnRequest(
  userId: string,
  data: { orderPublicId: string; type: ReturnRequestType; reason: string }
) {
  const order = await prisma.order.findFirst({ where: { publicId: data.orderPublicId } });
  if (!order) {
    throw new AppError(404, "Order not found", "NOT_FOUND");
  }
  if (order.userId !== userId) {
    throw new AppError(403, "You do not own this order", "FORBIDDEN");
  }
  if (!RETURN_ELIGIBLE_STATUSES.includes(order.status)) {
    throw new AppError(
      400,
      "Returns, exchanges, and warranty claims can only be requested after your order is delivered",
      "NOT_ELIGIBLE"
    );
  }
  const existing = await prisma.returnRequest.findFirst({
    where: { orderId: order.id, status: { in: OPEN_RETURN_STATUSES } },
  });
  if (existing) {
    throw new AppError(
      400,
      "A return request for this order is already in progress",
      "ALREADY_REQUESTED"
    );
  }
  return prisma.returnRequest.create({
    data: {
      publicId: newPublicId("rma"),
      orderId: order.id,
      userId,
      type: data.type,
      reason: data.reason,
    },
  });
}

export async function listReturnRequestsForUser(userId: string) {
  const rows = await prisma.returnRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { order: { select: { publicId: true } } },
  });
  return rows.map((r) => ({
    publicId: r.publicId,
    orderPublicId: r.order.publicId,
    type: r.type,
    status: r.status,
    reason: r.reason,
    adminNote: r.adminNote,
    createdAt: r.createdAt,
    resolvedAt: r.resolvedAt,
  }));
}

export async function listReturnRequestsAdmin(status?: ReturnRequestStatus) {
  const rows = await prisma.returnRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      order: { select: { publicId: true } },
      user: { select: { publicId: true, email: true } },
    },
  });
  return rows.map((r) => ({
    publicId: r.publicId,
    orderPublicId: r.order.publicId,
    user: r.user,
    type: r.type,
    status: r.status,
    reason: r.reason,
    adminNote: r.adminNote,
    createdAt: r.createdAt,
    resolvedAt: r.resolvedAt,
  }));
}

export async function updateReturnRequestAdmin(
  publicId: string,
  data: { status: ReturnRequestStatus; adminNote?: string }
) {
  const existing = await prisma.returnRequest.findUnique({ where: { publicId } });
  if (!existing) {
    throw new AppError(404, "Return request not found", "NOT_FOUND");
  }
  return prisma.returnRequest.update({
    where: { publicId },
    data: {
      status: data.status,
      ...(data.adminNote !== undefined && { adminNote: data.adminNote }),
      resolvedAt: RESOLVED_STATUSES.includes(data.status) ? new Date() : existing.resolvedAt,
    },
  });
}
