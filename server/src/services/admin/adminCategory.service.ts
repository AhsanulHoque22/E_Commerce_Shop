import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import {
  createCategory as createCategoryBase,
} from "../category/category.service.js";

export async function adminCreateCategory(
  data: {
    slug: string;
    name: string;
    nameBn?: string;
    parentPublicId?: string;
    sortOrder?: number;
    attributeSchema?: unknown;
  },
  actorUserId: string
) {
  const row = await createCategoryBase(data);
  await prisma.auditLog.create({
    data: {
      action: "admin.category.create",
      entityType: "category",
      entityId: row.publicId,
      userId: actorUserId,
      metadata: { slug: row.slug, parentPublicId: data.parentPublicId } as object,
    },
  });
  return row;
}

export async function adminUpdateCategory(
  publicId: string,
  data: Partial<{
    name: string;
    nameBn: string | null;
    sortOrder: number;
    attributeSchema: unknown | null;
  }>,
  actorUserId: string
) {
  const existing = await prisma.category.findUnique({ where: { publicId } });
  if (!existing) {
    throw new AppError(404, "Category not found", "NOT_FOUND");
  }
  const row = await prisma.category.update({
    where: { publicId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.nameBn !== undefined && { nameBn: data.nameBn }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      ...(data.attributeSchema !== undefined && {
        attributeSchema:
          data.attributeSchema === null
            ? Prisma.DbNull
            : (data.attributeSchema as Prisma.InputJsonValue),
      }),
    },
  });
  await prisma.auditLog.create({
    data: {
      action: "admin.category.update",
      entityType: "category",
      entityId: publicId,
      userId: actorUserId,
    },
  });
  return row;
}

export async function adminDeleteCategory(publicId: string, actorUserId: string) {
  const existing = await prisma.category.findUnique({
    where: { publicId },
    include: {
      _count: { select: { products: true, children: true } },
    },
  });
  if (!existing) {
    throw new AppError(404, "Category not found", "NOT_FOUND");
  }
  if (existing._count.products > 0) {
    throw new AppError(400, "Category has products assigned", "HAS_PRODUCTS");
  }
  if (existing._count.children > 0) {
    throw new AppError(400, "Category has subcategories", "HAS_CHILDREN");
  }
  await prisma.category.delete({ where: { publicId } });
  await prisma.auditLog.create({
    data: {
      action: "admin.category.delete",
      entityType: "category",
      entityId: publicId,
      userId: actorUserId,
    },
  });
}
