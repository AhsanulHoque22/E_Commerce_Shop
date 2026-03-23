import { OrderStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { newPublicId } from "../../utils/ids.js";
import { buildInvoicePdf } from "./invoicePdf.js";
import { buildReceiptPdf } from "./receiptPdf.js";
import {
  ORDER_TRACKING_STATUSES,
  orderAllowsInvoice,
  orderAllowsReceipt,
} from "./orderStatusFlow.js";

/** Shape of `Product` per prisma/schema.prisma (avoids stale `prisma generate` typings). */
type OrderCartProduct = {
  id: string;
  name: string;
  price: Prisma.Decimal;
  stock: number;
  readyToShip: boolean;
  status: "ACTIVE" | "OUT_OF_STOCK" | "DISCONTINUED";
};

export type ShippingAddress = {
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  district: string;
  postalCode?: string;
  country: string;
};

function roundMoney(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

/** Avoid exposing long gateway tokens in storefront JSON; PDFs keep full ref for the owner. */
function maskPaymentReferenceForCustomer(ref: string | null | undefined): string | null {
  if (!ref?.trim()) return null;
  const t = ref.trim();
  if (t.length <= 10) return t;
  return `••••${t.slice(-4)}`;
}

function stageTimestamp(
  o: {
    createdAt: Date;
    approvedAt: Date | null;
    paymentPendingAt: Date | null;
    paidAt: Date | null;
    shippedAt: Date | null;
    outForDeliveryAt: Date | null;
    deliveredAt: Date | null;
    completedAt: Date | null;
  },
  status: OrderStatus
): string | null {
  switch (status) {
    case OrderStatus.PENDING_APPROVAL:
      return o.createdAt.toISOString();
    case OrderStatus.APPROVED:
      return o.approvedAt?.toISOString() ?? null;
    case OrderStatus.PAYMENT_PENDING:
      return o.paymentPendingAt?.toISOString() ?? null;
    case OrderStatus.PAID:
      return o.paidAt?.toISOString() ?? null;
    case OrderStatus.SHIPPED:
      return o.shippedAt?.toISOString() ?? null;
    case OrderStatus.OUT_FOR_DELIVERY:
      return o.outForDeliveryAt?.toISOString() ?? null;
    case OrderStatus.DELIVERED:
      return o.deliveredAt?.toISOString() ?? null;
    case OrderStatus.COMPLETED:
      return o.completedAt?.toISOString() ?? null;
    default:
      return null;
  }
}

async function ensureDocumentReferences(orderId: string): Promise<void> {
  const o = await prisma.order.findUnique({ where: { id: orderId } });
  if (!o) return;
  const data: Prisma.OrderUpdateInput = {};
  const now = new Date();
  if (orderAllowsInvoice(o.status) && !o.invoicePublicId) {
    data.invoicePublicId = newPublicId("inv");
    data.invoiceIssuedAt = o.approvedAt ?? o.updatedAt ?? now;
  }
  if (orderAllowsReceipt(o.status) && !o.receiptPublicId) {
    data.receiptPublicId = newPublicId("rcp");
    data.receiptIssuedAt = o.paidAt ?? o.updatedAt ?? now;
  }
  if (Object.keys(data).length > 0) {
    await prisma.order.update({ where: { id: orderId }, data });
  }
}

/** Bangladesh e-commerce style: 100% if all lines ready-to-ship and in stock; else max 10% advance. */
export function computeAdvancePercent(
  lines: { stock: number; quantity: number; readyToShip: boolean }[]
): { advancePercent: number; reason: string } {
  for (const l of lines) {
    if (l.stock < l.quantity) {
      throw new AppError(400, "Cart has items with insufficient stock", "NO_STOCK");
    }
  }
  const allReady = lines.every((l) => l.readyToShip);
  if (allReady) {
    return { advancePercent: 100, reason: "ready_to_ship" };
  }
  return { advancePercent: 10, reason: "preorder_or_not_ready" };
}

export async function createOrderFromCart(
  userId: string,
  input: {
    shipping: ShippingAddress;
    contactEmail: string;
    contactPhone?: string;
    paymentMethod: string;
    notes?: string;
  }
) {
  const cart = await prisma.cartItem.findMany({
    where: { userId },
    include: { product: true },
  });
  if (cart.length === 0) {
    throw new AppError(400, "Cart is empty", "EMPTY_CART");
  }
  for (const row of cart) {
    const p = row.product as unknown as OrderCartProduct;
    if (p.status !== "ACTIVE") {
      throw new AppError(
        400,
        `Product unavailable: ${p.name}`,
        "INACTIVE"
      );
    }
    if (p.stock < row.quantity || p.stock <= 0) {
      throw new AppError(400, "Cart has items with insufficient stock", "NO_STOCK");
    }
  }

  const { advancePercent } = computeAdvancePercent(
    cart.map((c) => {
      const p = c.product as unknown as OrderCartProduct;
      return {
        stock: p.stock,
        quantity: c.quantity,
        readyToShip: p.readyToShip,
      };
    })
  );

  let subtotal = 0;
  const orderItems = cart.map((c) => {
    const p = c.product as unknown as OrderCartProduct;
    const unit = Number(p.price);
    subtotal += unit * c.quantity;
    return {
      productId: p.id,
      quantity: c.quantity,
      unitPrice: p.price,
      nameSnapshot: p.name,
    };
  });

  const shippingTotal = 0;
  const total = subtotal + shippingTotal;
  const advanceAmount = (total * advancePercent) / 100;

  const order = await prisma.$transaction(async (tx) => {
    const o = await tx.order.create({
      data: {
        publicId: newPublicId("order"),
        userId,
        status: OrderStatus.PENDING_APPROVAL,
        paymentMethod: input.paymentMethod,
        paymentReference: null,
        paymentStatus: "awaiting_approval",
        advancePercent,
        advanceAmount,
        subtotal,
        shippingTotal,
        total,
        shippingAddress: input.shipping as object,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        notes: input.notes,
        items: { create: orderItems },
      },
      include: { items: true },
    });

    await tx.cartItem.deleteMany({ where: { userId } });
    return o;
  });

  await prisma.auditLog.create({
    data: {
      action: "order.create",
      entityType: "order",
      entityId: order.publicId,
      userId,
      metadata: {
        total: roundMoney(Number(order.total)),
        advancePercent: order.advancePercent,
      },
    },
  });

  return {
    publicId: order.publicId,
    status: order.status,
    subtotal: roundMoney(Number(order.subtotal)),
    shippingTotal: roundMoney(Number(order.shippingTotal)),
    total: roundMoney(Number(order.total)),
    advancePercent: order.advancePercent,
    advanceAmount: roundMoney(Number(order.advanceAmount)),
    paymentStatus: order.paymentStatus,
    items: order.items.map((i) => ({
      name: i.nameSnapshot,
      quantity: i.quantity,
      unitPrice: roundMoney(Number(i.unitPrice)),
    })),
  };
}

export async function listOrdersForUser(userId: string) {
  const rows = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
  return rows.map((o) => ({
    publicId: o.publicId,
    status: o.status,
    total: roundMoney(Number(o.total)),
    advancePercent: o.advancePercent,
    advanceAmount: roundMoney(Number(o.advanceAmount)),
    createdAt: o.createdAt,
    itemCount: o.items.length,
    paymentStatus: o.paymentStatus,
  }));
}

function mapOrderDetail(o: {
  publicId: string;
  status: OrderStatus;
  subtotal: Prisma.Decimal;
  shippingTotal: Prisma.Decimal;
  total: Prisma.Decimal;
  advancePercent: number;
  advanceAmount: Prisma.Decimal;
  paymentMethod: string | null;
  paymentStatus: string;
  paymentReference: string | null;
  currency: string;
  shippingAddress: Prisma.JsonValue;
  contactEmail: string;
  contactPhone: string | null;
  createdAt: Date;
  shipmentTrackingId: string | null;
  courierName: string | null;
  shipmentTrackingUrl: string | null;
  invoicePublicId: string | null;
  invoiceIssuedAt: Date | null;
  receiptPublicId: string | null;
  receiptIssuedAt: Date | null;
  approvedAt: Date | null;
  paymentPendingAt: Date | null;
  paidAt: Date | null;
  shippedAt: Date | null;
  outForDeliveryAt: Date | null;
  deliveredAt: Date | null;
  completedAt: Date | null;
  items: { nameSnapshot: string; quantity: number; unitPrice: Prisma.Decimal }[];
}) {
  const fulfillmentTimeline = ORDER_TRACKING_STATUSES.map((status) => ({
    status,
    reachedAt: stageTimestamp(o, status),
  }));

  const trackingIndex =
    o.status === OrderStatus.CANCELLED
      ? -1
      : ORDER_TRACKING_STATUSES.indexOf(o.status);

  return {
    publicId: o.publicId,
    status: o.status,
    subtotal: roundMoney(Number(o.subtotal)),
    shippingTotal: roundMoney(Number(o.shippingTotal)),
    total: roundMoney(Number(o.total)),
    advancePercent: o.advancePercent,
    advanceAmount: roundMoney(Number(o.advanceAmount)),
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    paymentReference: maskPaymentReferenceForCustomer(o.paymentReference),
    currency: o.currency,
    shippingAddress: o.shippingAddress,
    contactEmail: o.contactEmail,
    contactPhone: o.contactPhone,
    createdAt: o.createdAt,
    shipmentTrackingId: o.shipmentTrackingId,
    courierName: o.courierName,
    shipmentTrackingUrl: o.shipmentTrackingUrl,
    invoicePublicId: o.invoicePublicId,
    invoiceIssuedAt: o.invoiceIssuedAt,
    receiptPublicId: o.receiptPublicId,
    receiptIssuedAt: o.receiptIssuedAt,
    invoiceAvailable: orderAllowsInvoice(o.status),
    receiptAvailable: orderAllowsReceipt(o.status),
    documentPaymentStatus:
      o.status === OrderStatus.CANCELLED
        ? "CANCELLED"
        : o.status === OrderStatus.APPROVED ||
            o.status === OrderStatus.PAYMENT_PENDING
          ? "INCOMPLETE"
          : orderAllowsReceipt(o.status)
            ? "COMPLETED"
            : "INCOMPLETE",
    fulfillmentTimeline,
    trackingIndex,
    items: o.items.map((i) => ({
      name: i.nameSnapshot,
      quantity: i.quantity,
      unitPrice: roundMoney(Number(i.unitPrice)),
    })),
  };
}

export async function getOrderForUser(userId: string, publicId: string) {
  const o = await prisma.order.findFirst({
    where: { publicId, userId },
    include: { items: true },
  });
  if (!o) {
    throw new AppError(404, "Order not found", "NOT_FOUND");
  }
  await ensureDocumentReferences(o.id);
  const fresh = await prisma.order.findFirst({
    where: { id: o.id },
    include: { items: true },
  });
  if (!fresh) {
    throw new AppError(404, "Order not found", "NOT_FOUND");
  }
  return mapOrderDetail(fresh);
}

export async function getInvoicePdfForUser(
  userId: string,
  publicId: string
): Promise<Buffer> {
  const o = await prisma.order.findFirst({
    where: { publicId, userId },
    include: { items: true },
  });
  if (!o) {
    throw new AppError(404, "Order not found", "NOT_FOUND");
  }
  await ensureDocumentReferences(o.id);
  const row = await prisma.order.findFirst({
    where: { id: o.id },
    include: { items: true },
  });
  if (!row) {
    throw new AppError(404, "Order not found", "NOT_FOUND");
  }
  if (!orderAllowsInvoice(row.status)) {
    throw new AppError(
      403,
      "Invoice is available after your order is confirmed by the store",
      "INVOICE_NOT_READY"
    );
  }
  if (!row.invoicePublicId || !row.invoiceIssuedAt) {
    throw new AppError(500, "Invoice reference missing", "INVOICE_STATE");
  }
  return buildInvoicePdf({
    invoicePublicId: row.invoicePublicId,
    invoiceIssuedAt: row.invoiceIssuedAt,
    orderPublicId: row.publicId,
    status: row.status,
    createdAt: row.createdAt,
    currency: row.currency,
    subtotal: roundMoney(Number(row.subtotal)),
    shippingTotal: roundMoney(Number(row.shippingTotal)),
    total: roundMoney(Number(row.total)),
    advancePercent: row.advancePercent,
    advanceAmount: roundMoney(Number(row.advanceAmount)),
    paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus,
    paymentReference: row.paymentReference,
    receiptPublicId: row.receiptPublicId,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    shippingAddress: row.shippingAddress,
    items: row.items.map((i) => ({
      name: i.nameSnapshot,
      quantity: i.quantity,
      unitPrice: roundMoney(Number(i.unitPrice)),
    })),
  });
}

export async function getReceiptPdfForUser(
  userId: string,
  publicId: string
): Promise<Buffer> {
  const o = await prisma.order.findFirst({
    where: { publicId, userId },
    include: { items: true },
  });
  if (!o) {
    throw new AppError(404, "Order not found", "NOT_FOUND");
  }
  await ensureDocumentReferences(o.id);
  const row = await prisma.order.findFirst({
    where: { id: o.id },
    include: { items: true },
  });
  if (!row) {
    throw new AppError(404, "Order not found", "NOT_FOUND");
  }
  if (!orderAllowsReceipt(row.status)) {
    throw new AppError(
      403,
      "Payment receipt is available after payment is completed",
      "RECEIPT_NOT_READY"
    );
  }
  if (!row.receiptPublicId || !row.receiptIssuedAt) {
    throw new AppError(500, "Receipt reference missing", "RECEIPT_STATE");
  }
  return buildReceiptPdf({
    receiptPublicId: row.receiptPublicId,
    receiptIssuedAt: row.receiptIssuedAt,
    orderPublicId: row.publicId,
    currency: row.currency,
    amountPaid: roundMoney(Number(row.total)),
    paymentMethod: row.paymentMethod,
    paymentReference: row.paymentReference,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
  });
}
