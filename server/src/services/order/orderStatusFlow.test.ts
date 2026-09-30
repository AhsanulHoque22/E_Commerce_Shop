import { test } from "node:test";
import assert from "node:assert/strict";
import { OrderStatus } from "@prisma/client";
import {
  adminCanTransition,
  orderAllowsInvoice,
  orderAllowsReceipt,
  invoiceDocumentPaymentLabel,
  ADMIN_STATUS_TRANSITIONS,
} from "./orderStatusFlow.js";

test("adminCanTransition allows only defined forward edges", () => {
  assert.equal(
    adminCanTransition(OrderStatus.PENDING_APPROVAL, OrderStatus.APPROVED),
    true
  );
  assert.equal(
    adminCanTransition(OrderStatus.PENDING_APPROVAL, OrderStatus.SHIPPED),
    false
  );
  assert.equal(
    adminCanTransition(OrderStatus.DELIVERED, OrderStatus.COMPLETED),
    true
  );
});

test("terminal statuses (COMPLETED, CANCELLED) have no outgoing transitions", () => {
  assert.deepEqual(ADMIN_STATUS_TRANSITIONS[OrderStatus.COMPLETED], []);
  assert.deepEqual(ADMIN_STATUS_TRANSITIONS[OrderStatus.CANCELLED], []);
});

test("every non-terminal status can be cancelled except after DELIVERED", () => {
  for (const [status, edges] of Object.entries(ADMIN_STATUS_TRANSITIONS)) {
    if (
      status === OrderStatus.COMPLETED ||
      status === OrderStatus.CANCELLED ||
      status === OrderStatus.DELIVERED
    ) {
      continue;
    }
    assert.ok(
      edges.includes(OrderStatus.CANCELLED),
      `${status} should allow cancellation`
    );
  }
});

test("invoice/receipt eligibility follows the fulfillment sequence", () => {
  assert.equal(orderAllowsInvoice(OrderStatus.PENDING_APPROVAL), false);
  assert.equal(orderAllowsInvoice(OrderStatus.APPROVED), true);
  assert.equal(orderAllowsReceipt(OrderStatus.APPROVED), false);
  assert.equal(orderAllowsReceipt(OrderStatus.PAID), true);
});

test("invoice payment label reflects whether payment is settled", () => {
  assert.equal(invoiceDocumentPaymentLabel(OrderStatus.APPROVED), "INCOMPLETE");
  assert.equal(
    invoiceDocumentPaymentLabel(OrderStatus.PAYMENT_PENDING),
    "INCOMPLETE"
  );
  assert.equal(invoiceDocumentPaymentLabel(OrderStatus.PAID), "COMPLETED");
});
