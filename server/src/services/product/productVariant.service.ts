import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { newPublicId } from "../../utils/ids.js";
import type {
  CreateProductVariantInput,
  UpdateProductVariantInput,
} from "../../schemas/productVariant.schema.js";

function decimalToString(d: Prisma.Decimal): string {
  return d.toString();
}

function mapVariant(v: {
  publicId: string;
  sku: string;
  options: Prisma.JsonValue;
  price: Prisma.Decimal;
  comparePrice: Prisma.Decimal | null;
  stock: number;
  isDefault: boolean;
  mainImageUrl: string | null;
  mainImagePublicId: string | null;
  sortOrder: number;
}) {
  return {
    publicId: v.publicId,
    sku: v.sku,
    options: v.options,
    price: decimalToString(v.price),
    comparePrice: v.comparePrice ? decimalToString(v.comparePrice) : null,
    stock: v.stock,
    isDefault: v.isDefault,
    mainImageUrl: v.mainImageUrl,
    mainImagePublicId: v.mainImagePublicId,
    sortOrder: v.sortOrder,
  };
}

async function findProductOrThrow(productPublicId: string) {
  const product = await prisma.product.findUnique({
    where: { publicId: productPublicId },
  });
  if (!product) {
    throw new AppError(404, "Product not found", "NOT_FOUND");
  }
  return product;
}

async function findVariantOrThrow(productId: string, variantPublicId: string) {
  const variant = await prisma.productVariant.findFirst({
    where: { publicId: variantPublicId, productId },
  });
  if (!variant) {
    throw new AppError(404, "Variant not found", "NOT_FOUND");
  }
  return variant;
}

export async function listVariantsForProduct(productPublicId: string) {
  const product = await findProductOrThrow(productPublicId);
  const variants = await prisma.productVariant.findMany({
    where: { productId: product.id },
    orderBy: { sortOrder: "asc" },
  });
  return variants.map(mapVariant);
}

export async function createVariant(
  productPublicId: string,
  data: CreateProductVariantInput,
  actorUserId: string
) {
  const product = await findProductOrThrow(productPublicId);
  const variant = await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      // Only one variant can be "the" default per product.
      await tx.productVariant.updateMany({
        where: { productId: product.id },
        data: { isDefault: false },
      });
    }
    return tx.productVariant.create({
      data: {
        publicId: newPublicId("pvar"),
        productId: product.id,
        sku: data.sku,
        options: data.options as Prisma.InputJsonValue,
        price: data.price,
        comparePrice: data.comparePrice,
        stock: data.stock,
        isDefault: data.isDefault ?? false,
        mainImageUrl: data.mainImageUrl,
        mainImagePublicId: data.mainImagePublicId,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  });
  await prisma.auditLog.create({
    data: {
      action: "admin.productVariant.create",
      entityType: "productVariant",
      entityId: variant.publicId,
      userId: actorUserId,
      metadata: { productPublicId, sku: variant.sku } as object,
    },
  });
  return mapVariant(variant);
}

export async function updateVariant(
  productPublicId: string,
  variantPublicId: string,
  data: UpdateProductVariantInput,
  actorUserId: string
) {
  const product = await findProductOrThrow(productPublicId);
  const existing = await findVariantOrThrow(product.id, variantPublicId);

  const variant = await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.productVariant.updateMany({
        where: { productId: product.id, id: { not: existing.id } },
        data: { isDefault: false },
      });
    }
    return tx.productVariant.update({
      where: { id: existing.id },
      data: {
        ...(data.sku !== undefined && { sku: data.sku }),
        ...(data.options !== undefined && {
          options: data.options as Prisma.InputJsonValue,
        }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.comparePrice !== undefined && {
          comparePrice: data.comparePrice ?? undefined,
        }),
        ...(data.stock !== undefined && { stock: data.stock }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        ...(data.mainImageUrl !== undefined && {
          mainImageUrl: data.mainImageUrl ?? undefined,
        }),
        ...(data.mainImagePublicId !== undefined && {
          mainImagePublicId: data.mainImagePublicId ?? undefined,
        }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    });
  });
  await prisma.auditLog.create({
    data: {
      action: "admin.productVariant.update",
      entityType: "productVariant",
      entityId: variant.publicId,
      userId: actorUserId,
      metadata: { productPublicId, fields: Object.keys(data) } as object,
    },
  });
  return mapVariant(variant);
}

export async function deleteVariant(
  productPublicId: string,
  variantPublicId: string,
  actorUserId: string
) {
  const product = await findProductOrThrow(productPublicId);
  const existing = await findVariantOrThrow(product.id, variantPublicId);
  await prisma.productVariant.delete({ where: { id: existing.id } });
  await prisma.auditLog.create({
    data: {
      action: "admin.productVariant.delete",
      entityType: "productVariant",
      entityId: variantPublicId,
      userId: actorUserId,
      metadata: { productPublicId } as object,
    },
  });
}
