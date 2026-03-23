import { ProductStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";

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
    },
  });
  let subtotal = 0;
  const lines = items.map((row) => {
    const price = Number(row.product.price);
    const line = price * row.quantity;
    const available =
      row.product.status === ProductStatus.ACTIVE && row.product.stock > 0;
    if (available) {
      subtotal += line;
    }
    return {
      productPublicId: row.product.publicId,
      name: row.product.name,
      quantity: row.quantity,
      unitPrice: price.toFixed(2),
      lineTotal: line.toFixed(2),
      stock: row.product.stock,
      mainImageUrl: row.product.mainImageUrl,
      inactive: !available,
    };
  });
  return { items: lines, subtotal: subtotal.toFixed(2) };
}

export async function addToCart(
  userId: string,
  productPublicId: string,
  quantity: number
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
  if (product.stock < quantity || product.stock <= 0) {
    throw new AppError(400, "Insufficient stock", "NO_STOCK");
  }
  await prisma.cartItem.upsert({
    where: {
      userId_productId: { userId, productId: product.id },
    },
    create: { userId, productId: product.id, quantity },
    update: { quantity },
  });
  return getCart(userId);
}

export async function updateCartLine(
  userId: string,
  productPublicId: string,
  quantity: number
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
  if (quantity <= 0) {
    await prisma.cartItem.deleteMany({
      where: { userId, productId: product.id },
    });
    return getCart(userId);
  }
  if (product.stock < quantity || product.stock <= 0) {
    throw new AppError(400, "Insufficient stock", "NO_STOCK");
  }
  await prisma.cartItem.updateMany({
    where: { userId, productId: product.id },
    data: { quantity },
  });
  return getCart(userId);
}

export async function removeCartLine(userId: string, productPublicId: string) {
  const product = await prisma.product.findFirst({
    where: { publicId: productPublicId },
  });
  if (!product) {
    throw new AppError(404, "Product not found", "NOT_FOUND");
  }
  await prisma.cartItem.deleteMany({
    where: { userId, productId: product.id },
  });
  return getCart(userId);
}
