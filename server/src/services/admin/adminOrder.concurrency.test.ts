import { test } from "node:test";
import assert from "node:assert/strict";
import { OrderStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { newPublicId } from "../../utils/ids.js";
import { adminUpdateOrderStatus } from "./adminOrder.service.js";

/**
 * Regression test for the oversell race condition: five orders each claim 2
 * units of a product with only 5 units of stock, then all five are approved
 * concurrently. Before the fix (read-then-write stock decrement inside a
 * transaction, no atomic guard) this could let more than 2 orders succeed
 * and drive stock negative. The fix uses an atomic conditional UPDATE, so
 * exactly floor(5/2)=2 approvals should succeed and the rest must fail with
 * NO_STOCK, and stock must never go negative.
 */
test("concurrent order approvals cannot oversell stock", async () => {
  const category = await prisma.category.create({
    data: {
      publicId: newPublicId("cat"),
      slug: `test-cat-${Date.now()}`,
      name: "Concurrency Test Category",
    },
  });

  const product = await prisma.product.create({
    data: {
      publicId: newPublicId("prod"),
      sku: `TEST-CONC-${Date.now()}`,
      name: "Concurrency Test Product",
      description: "test",
      price: 100,
      stock: 5,
      readyToShip: true,
      categoryId: category.id,
    },
  });

  const user = await prisma.user.create({
    data: {
      publicId: newPublicId("usr"),
      email: `conc-test-${Date.now()}@example.com`,
      passwordHash: "x",
    },
  });

  const orderCount = 5;
  const qtyPerOrder = 2;
  const orders = await Promise.all(
    Array.from({ length: orderCount }, async () => {
      const order = await prisma.order.create({
        data: {
          publicId: newPublicId("ord"),
          userId: user.id,
          status: OrderStatus.PENDING_APPROVAL,
          advanceAmount: 200,
          subtotal: 200,
          total: 200,
          shippingAddress: {},
          contactEmail: user.email,
          items: {
            create: {
              productId: product.id,
              quantity: qtyPerOrder,
              unitPrice: 100,
              nameSnapshot: product.name,
            },
          },
        },
      });
      return order;
    })
  );

  try {
    const results = await Promise.allSettled(
      orders.map((o) =>
        adminUpdateOrderStatus({
          publicId: o.publicId,
          nextStatus: OrderStatus.APPROVED,
          actorUserId: user.id,
        })
      )
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    const finalProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });

    assert.equal(
      succeeded,
      Math.floor(5 / qtyPerOrder),
      `expected exactly ${Math.floor(5 / qtyPerOrder)} approvals to succeed under 5 units of stock, got ${succeeded}`
    );
    assert.equal(failed, orderCount - succeeded);
    assert.ok(
      finalProduct.stock >= 0,
      `stock went negative: ${finalProduct.stock}`
    );
    assert.equal(finalProduct.stock, 5 - succeeded * qtyPerOrder);
  } finally {
    await prisma.orderItem.deleteMany({
      where: { orderId: { in: orders.map((o) => o.id) } },
    });
    await prisma.order.deleteMany({ where: { id: { in: orders.map((o) => o.id) } } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});
