import { Prisma, ProductStatus } from "@prisma/client";
import { AppError } from "../../utils/AppError.js";

/** The subset of an OrderItem row needed to move stock for one order line. */
export type StockAffectingOrderLine = {
  productId: string;
  productVariantId: string | null;
  quantity: number;
};

/**
 * Atomically decrements stock for one order line inside an existing
 * transaction. Targets the ProductVariant row when the line has a
 * productVariantId (variant-bearing product, sold by variant); otherwise
 * falls back to today's Product-row logic unchanged.
 *
 * Mirrors adminOrder.service.ts's applyStockDecrement guard pattern exactly:
 * the stock check and the decrement happen in the SAME conditional UPDATE
 * (`updateMany` with a `stock: { gte: quantity }` where-clause), not a
 * separate read-then-write, so two concurrent approvals against the same
 * low-stock row can't both pass a stale check and oversell.
 *
 * Throws AppError(409, ..., "NO_STOCK") if the row can't cover the quantity
 * (or no longer exists), and AppError(409, ..., "BAD_PRODUCT") if the parent
 * product has been discontinued (non-variant path only — a variant's own
 * row has no independent discontinued state).
 */
export async function decrementVariantOrProductStock(
  tx: Prisma.TransactionClient,
  line: StockAffectingOrderLine
): Promise<void> {
  if (line.productVariantId) {
    const variant = await tx.productVariant.findUnique({
      where: { id: line.productVariantId },
    });
    if (!variant) {
      throw new AppError(409, "Insufficient stock to approve order", "NO_STOCK");
    }
    const result = await tx.productVariant.updateMany({
      where: { id: line.productVariantId, stock: { gte: line.quantity } },
      data: { stock: { decrement: line.quantity } },
    });
    if (result.count === 0) {
      throw new AppError(409, "Insufficient stock to approve order", "NO_STOCK");
    }
    return;
  }

  const product = await tx.product.findUnique({ where: { id: line.productId } });
  if (!product) {
    throw new AppError(409, "Insufficient stock to approve order", "NO_STOCK");
  }
  if (product.status === ProductStatus.DISCONTINUED) {
    throw new AppError(409, "Product discontinued", "BAD_PRODUCT");
  }
  const result = await tx.product.updateMany({
    where: { id: line.productId, stock: { gte: line.quantity } },
    data: { stock: { decrement: line.quantity } },
  });
  if (result.count === 0) {
    throw new AppError(409, "Insufficient stock to approve order", "NO_STOCK");
  }
  await tx.product.updateMany({
    where: { id: line.productId, stock: { lte: 0 } },
    data: { status: ProductStatus.OUT_OF_STOCK },
  });
}

/**
 * Atomically restores (increments) stock for one order line on cancellation,
 * mirroring adminOrder.service.ts's applyStockRestore. Targets the
 * ProductVariant row when present, else the parent Product row (unchanged
 * today's logic, including flipping the product back to ACTIVE if it had
 * been auto-marked OUT_OF_STOCK). A variant's own stock has no status flag
 * to restore — Product.status is never driven by a single variant's stock.
 */
export async function restoreVariantOrProductStock(
  tx: Prisma.TransactionClient,
  line: StockAffectingOrderLine
): Promise<void> {
  if (line.productVariantId) {
    const variant = await tx.productVariant.findUnique({
      where: { id: line.productVariantId },
    });
    if (!variant) {
      return;
    }
    await tx.productVariant.update({
      where: { id: line.productVariantId },
      data: { stock: { increment: line.quantity } },
    });
    return;
  }

  const product = await tx.product.findUnique({ where: { id: line.productId } });
  if (!product) {
    return;
  }
  await tx.product.update({
    where: { id: line.productId },
    data: { stock: { increment: line.quantity } },
  });
  if (product.status !== ProductStatus.DISCONTINUED) {
    await tx.product.updateMany({
      where: { id: line.productId, stock: { gt: 0 } },
      data: { status: ProductStatus.ACTIVE },
    });
  }
}
