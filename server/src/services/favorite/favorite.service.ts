import { ProductStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { storefrontWhere } from "../product/product.service.js";

export async function listFavorites(userId: string) {
  const rows = await prisma.favorite.findMany({
    where: {
      userId,
      product: { status: { not: ProductStatus.DISCONTINUED } },
    },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        include: {
          category: { select: { publicId: true, name: true, slug: true } },
        },
      },
    },
  });
  return rows.map((r) => {
      const p = r.product;
      return {
        productPublicId: p.publicId,
        name: p.name,
        brand: p.brand,
        price: p.price.toString(),
        mainImageUrl: p.mainImageUrl,
        inStock: p.stock > 0,
        category: p.category,
      };
    });
}

export async function addFavorite(userId: string, productPublicId: string) {
  const product = await prisma.product.findFirst({
    where: { publicId: productPublicId, ...storefrontWhere },
  });
  if (!product) {
    throw new AppError(404, "Product not found", "NOT_FOUND");
  }
  await prisma.favorite.upsert({
    where: {
      userId_productId: { userId, productId: product.id },
    },
    create: { userId, productId: product.id },
    update: {},
  });
  return { ok: true };
}

export async function removeFavorite(userId: string, productPublicId: string) {
  const product = await prisma.product.findUnique({
    where: { publicId: productPublicId },
  });
  if (!product) {
    throw new AppError(404, "Product not found", "NOT_FOUND");
  }
  await prisma.favorite.deleteMany({
    where: { userId, productId: product.id },
  });
  return { ok: true };
}

export async function isFavorite(userId: string, productPublicId: string) {
  const product = await prisma.product.findUnique({
    where: { publicId: productPublicId },
    select: { id: true },
  });
  if (!product) {
    return false;
  }
  const row = await prisma.favorite.findUnique({
    where: {
      userId_productId: { userId, productId: product.id },
    },
  });
  return Boolean(row);
}

export async function countFavorites(userId: string) {
  return prisma.favorite.count({ where: { userId } });
}
