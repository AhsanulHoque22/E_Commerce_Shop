import { ProductStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";

/** Sane per-line ceiling so one line can't hoard all stock or blow up order totals. */
export const MAX_CART_LINE_QUANTITY = 20;

export async function getCart(userId: string) {
  const items = await prisma.cartItem.findMany({
    where: { userId },
    include: {
      product: {
        select: {
          publicId: true,
          name: true,
          price: true,
          stock: true,
          mainImageUrl: true,
          status: true,
        },
      },
      productVariant: {
        select: {
          publicId: true,
          options: true,
          price: true,
          stock: true,
          mainImageUrl: true,
        },
      },
    },
  });
  let subtotal = 0;
  const lines = items.map((row) => {
    const variant = row.productVariant;
    // Variant-bearing lines price/stock off the ProductVariant row; the
    // parent Product's own price/stock are stale fallbacks in that case.
    const price = variant ? Number(variant.price) : Number(row.product.price);
    const stock = variant ? variant.stock : row.product.stock;
    const line = price * row.quantity;
    const available = row.product.status === ProductStatus.ACTIVE && stock > 0;
    if (available) {
      subtotal += line;
    }
    return {
      productPublicId: row.product.publicId,
      productVariantPublicId: variant?.publicId ?? null,
      variantOptions: variant?.options ?? null,
      name: row.product.name,
      quantity: row.quantity,
      unitPrice: price.toFixed(2),
      lineTotal: line.toFixed(2),
      stock,
      mainImageUrl: variant?.mainImageUrl ?? row.product.mainImageUrl,
      inactive: !available,
    };
  });
  return { items: lines, subtotal: subtotal.toFixed(2) };
}

/**
 * Resolves an optional client-supplied variant publicId to its row, scoped to
 * the given product (so a variant of another product can't be smuggled in).
 * Returns null when no publicId is supplied — the non-variant path.
 */
async function resolveVariant(productId: string, productVariantPublicId?: string | null) {
  if (!productVariantPublicId) {
    return null;
  }
  const variant = await prisma.productVariant.findFirst({
    where: { publicId: productVariantPublicId, productId },
  });
  if (!variant) {
    throw new AppError(404, "Product variant not found", "NOT_FOUND");
  }
  return variant;
}

/**
 * A product with >=1 ProductVariant rows is sold by variant: its own
 * price/stock are inert, so a variant must be selected before it can affect
 * cart totals. Products with no variants are unaffected (variant stays null).
 */
async function requireVariantIfProductHasVariants(
  productId: string,
  variant: { id: string } | null
): Promise<void> {
  if (variant) {
    return;
  }
  const variantCount = await prisma.productVariant.count({ where: { productId } });
  if (variantCount > 0) {
    throw new AppError(400, "Select a variant for this product", "VARIANT_REQUIRED");
  }
}

export async function addToCart(
  userId: string,
  productPublicId: string,
  quantity: number,
  productVariantPublicId?: string
) {
  const product = await prisma.product.findFirst({
    where: {
      publicId: productPublicId,
      status: ProductStatus.ACTIVE,
    },
  });
  if (!product) {
    throw new AppError(404, "Product not found", "NOT_FOUND");
  }
  if (quantity > MAX_CART_LINE_QUANTITY) {
    throw new AppError(
      400,
      `Quantity per item is limited to ${MAX_CART_LINE_QUANTITY}`,
      "MAX_LINE_QUANTITY"
    );
  }
  const variant = await resolveVariant(product.id, productVariantPublicId);
  await requireVariantIfProductHasVariants(product.id, variant);
  const stock = variant ? variant.stock : product.stock;
  if (stock < quantity || stock <= 0) {
    throw new AppError(400, "Insufficient stock", "NO_STOCK");
  }
  // Dedupe on (userId, productId, productVariantId) with a manual
  // find-then-write instead of .upsert(): MySQL treats multiple NULLs in a
  // unique index as distinct, so relying on the DB constraint alone would let
  // duplicate null-variant rows through for non-variant products.
  const existingLine = await prisma.cartItem.findFirst({
    where: { userId, productId: product.id, productVariantId: variant?.id ?? null },
  });
  if (existingLine) {
    await prisma.cartItem.update({
      where: { id: existingLine.id },
      data: { quantity },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        userId,
        productId: product.id,
        productVariantId: variant?.id ?? null,
        quantity,
      },
    });
  }
  return getCart(userId);
}

export async function updateCartLine(
  userId: string,
  productPublicId: string,
  quantity: number,
  productVariantPublicId?: string
) {
  const product = await prisma.product.findFirst({
    where: {
      publicId: productPublicId,
      status: ProductStatus.ACTIVE,
    },
  });
  if (!product) {
    throw new AppError(404, "Product not found", "NOT_FOUND");
  }
  const variant = await resolveVariant(product.id, productVariantPublicId);
  if (quantity <= 0) {
    await prisma.cartItem.deleteMany({
      where: { userId, productId: product.id, productVariantId: variant?.id ?? null },
    });
    return getCart(userId);
  }
  if (quantity > MAX_CART_LINE_QUANTITY) {
    throw new AppError(
      400,
      `Quantity per item is limited to ${MAX_CART_LINE_QUANTITY}`,
      "MAX_LINE_QUANTITY"
    );
  }
  await requireVariantIfProductHasVariants(product.id, variant);
  const stock = variant ? variant.stock : product.stock;
  if (stock < quantity || stock <= 0) {
    throw new AppError(400, "Insufficient stock", "NO_STOCK");
  }
  await prisma.cartItem.updateMany({
    where: { userId, productId: product.id, productVariantId: variant?.id ?? null },
    data: { quantity },
  });
  return getCart(userId);
}

export async function removeCartLine(
  userId: string,
  productPublicId: string,
  productVariantPublicId?: string
) {
  const product = await prisma.product.findFirst({
    where: { publicId: productPublicId },
  });
  if (!product) {
    throw new AppError(404, "Product not found", "NOT_FOUND");
  }
  if (productVariantPublicId) {
    // Explicit variant given: remove only that line (a variant-bearing
    // product can have multiple cart lines, one per chosen variant).
    const variant = await resolveVariant(product.id, productVariantPublicId);
    await prisma.cartItem.deleteMany({
      where: { userId, productId: product.id, productVariantId: variant?.id },
    });
  } else {
    // No variant given: unchanged legacy behavior — remove every line for
    // this product (there is only ever one for a non-variant product).
    await prisma.cartItem.deleteMany({
      where: { userId, productId: product.id },
    });
  }
  return getCart(userId);
}
