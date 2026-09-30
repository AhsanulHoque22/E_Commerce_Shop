import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../config/db.js";
import { newPublicId } from "../../utils/ids.js";
import { decrementVariantOrProductStock } from "./productVariantStock.js";

/**
 * Variant equivalent of adminOrder.concurrency.test.ts's oversell regression
 * test: five "order approvals" each claim 2 units of a ProductVariant with
 * only 5 units of stock, hammered concurrently. The atomic conditional
 * UPDATE (stock check + decrement in one statement) must let exactly
 * floor(5/2)=2 succeed and stock must never go negative.
 */
test("concurrent variant stock decrements cannot oversell", async () => {
  const category = await prisma.category.create({
    data: {
      publicId: newPublicId("cat"),
      slug: `test-cat-variant-${Date.now()}`,
      name: "Variant Concurrency Test Category",
    },
  });

  const product = await prisma.product.create({
    data: {
      publicId: newPublicId("prod"),
      sku: `TEST-VCONC-${Date.now()}`,
      name: "Variant Concurrency Test Product",
      description: "test",
      price: 100,
      stock: 0, // product-level stock is inert once it has variants
      readyToShip: true,
      categoryId: category.id,
    },
  });

  const variant = await prisma.productVariant.create({
    data: {
      publicId: newPublicId("pvar"),
      productId: product.id,
      sku: `TEST-VCONC-VAR-${Date.now()}`,
      options: { color: "Black" },
      price: 100,
      stock: 5,
    },
  });

  const orderCount = 5;
  const qtyPerOrder = 2;

  try {
    const results = await Promise.allSettled(
      Array.from({ length: orderCount }, () =>
        prisma.$transaction((tx) =>
          decrementVariantOrProductStock(tx, {
            productId: product.id,
            productVariantId: variant.id,
            quantity: qtyPerOrder,
          })
        )
      )
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    const finalVariant = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variant.id },
    });

    assert.equal(
      succeeded,
      Math.floor(5 / qtyPerOrder),
      `expected exactly ${Math.floor(5 / qtyPerOrder)} decrements to succeed under 5 units of stock, got ${succeeded}`
    );
    assert.equal(failed, orderCount - succeeded);
    assert.ok(
      finalVariant.stock >= 0,
      `variant stock went negative: ${finalVariant.stock}`
    );
    assert.equal(finalVariant.stock, 5 - succeeded * qtyPerOrder);
  } finally {
    await prisma.productVariant.delete({ where: { id: variant.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.category.delete({ where: { id: category.id } });
  }
});
