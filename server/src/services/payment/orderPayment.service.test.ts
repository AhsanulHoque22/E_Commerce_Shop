import { test } from "node:test";
import assert from "node:assert/strict";
import { OrderStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { newPublicId } from "../../utils/ids.js";
import { AppError } from "../../utils/AppError.js";
import { markOrderPaidFromGateway } from "./orderPayment.service.js";

async function makeApprovedOrder(advanceAmount: number) {
  const user = await prisma.user.create({
    data: {
      publicId: newPublicId("usr"),
      email: `pay-test-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: "x",
    },
  });
  const order = await prisma.order.create({
    data: {
      publicId: newPublicId("ord"),
      userId: user.id,
      status: OrderStatus.APPROVED,
      advanceAmount,
      subtotal: advanceAmount,
      total: advanceAmount,
      shippingAddress: {},
      contactEmail: user.email,
    },
  });
  return { user, order };
}

async function cleanup(user: { id: string }, order: { id: string }) {
  await prisma.order.delete({ where: { id: order.id } });
  await prisma.user.delete({ where: { id: user.id } });
}

test("markOrderPaidFromGateway is idempotent under duplicate IPN delivery", async () => {
  const { user, order } = await makeApprovedOrder(200);
  try {
    const first = await markOrderPaidFromGateway(order.publicId, "sslcz-val-1", 200);
    assert.equal(first.alreadyPaid, false);

    const afterFirst = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    assert.equal(afterFirst.status, OrderStatus.PAID);
    assert.equal(afterFirst.paymentReference, "sslcz-val-1");
    assert.ok(afterFirst.receiptPublicId, "receipt should be issued on first confirmation");
    assert.ok(afterFirst.paidAt);

    // SSLCommerz (or our own success-redirect handler racing the IPN) fires again.
    const second = await markOrderPaidFromGateway(order.publicId, "sslcz-val-1", 200);
    assert.equal(second.alreadyPaid, true);

    const afterSecond = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    assert.equal(afterSecond.status, OrderStatus.PAID);
    assert.equal(afterSecond.receiptPublicId, afterFirst.receiptPublicId, "no duplicate receipt");
    assert.equal(afterSecond.paidAt?.getTime(), afterFirst.paidAt?.getTime(), "paidAt not overwritten");
  } finally {
    await cleanup(user, order);
  }
});

test("markOrderPaidFromGateway rejects a paid amount that doesn't match advanceAmount", async () => {
  const { user, order } = await makeApprovedOrder(200);
  try {
    await assert.rejects(
      () => markOrderPaidFromGateway(order.publicId, "sslcz-val-2", 50),
      AppError
    );
    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    assert.equal(fresh.status, OrderStatus.APPROVED, "order must not be marked PAID on amount mismatch");
    assert.equal(fresh.paymentReference, null);
  } finally {
    await cleanup(user, order);
  }
});

test("markOrderPaidFromGateway rejects orders not awaiting payment", async () => {
  const { user, order } = await makeApprovedOrder(200);
  // Move it straight to PENDING_APPROVAL-equivalent state by resetting status.
  await prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.CANCELLED } });
  try {
    await assert.rejects(
      () => markOrderPaidFromGateway(order.publicId, "sslcz-val-3", 200),
      AppError
    );
  } finally {
    await cleanup(user, order);
  }
});
