import { OrderStatus } from "@prisma/client";

/** Customer-visible fulfillment sequence (excludes CANCELLED). */
export const ORDER_TRACKING_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING_APPROVAL,
  OrderStatus.APPROVED,
  OrderStatus.PAYMENT_PENDING,
  OrderStatus.PAID,
  OrderStatus.SHIPPED,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
];

/** Admin-only valid single-step transitions. */
export const ADMIN_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING_APPROVAL]: [
    OrderStatus.APPROVED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.APPROVED]: [OrderStatus.PAYMENT_PENDING, OrderStatus.CANCELLED],
  [OrderStatus.PAYMENT_PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.OUT_FOR_DELIVERY]: [
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

export function adminCanTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ADMIN_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export const INVOICE_ALLOWED_STATUSES: OrderStatus[] = [
  OrderStatus.APPROVED,
  OrderStatus.PAYMENT_PENDING,
  OrderStatus.PAID,
  OrderStatus.SHIPPED,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
];

export const RECEIPT_ALLOWED_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.SHIPPED,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
];

export function orderAllowsInvoice(status: OrderStatus): boolean {
  return INVOICE_ALLOWED_STATUSES.includes(status);
}

export function orderAllowsReceipt(status: OrderStatus): boolean {
  return RECEIPT_ALLOWED_STATUSES.includes(status);
}

export function invoiceDocumentPaymentLabel(status: OrderStatus): "INCOMPLETE" | "COMPLETED" {
  if (
    status === OrderStatus.APPROVED ||
    status === OrderStatus.PAYMENT_PENDING
  ) {
    return "INCOMPLETE";
  }
  return "COMPLETED";
}
