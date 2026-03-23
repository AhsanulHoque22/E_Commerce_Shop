import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import {
  type CategoryAttributeDef,
  parseCategoryAttributeSchemaFromJson,
  safeParseCategoryAttributeSchema,
} from "../../domain/categoryAttributes.js";
import { AppError } from "../../utils/AppError.js";
import { newPublicId } from "../../utils/ids.js";

export type CategoryTreeNode = {
  publicId: string;
  slug: string;
  name: string;
  nameBn: string | null;
  children: CategoryTreeNode[];
};

export async function listCategories(): Promise<CategoryTreeNode[]> {
  const rows = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      publicId: true,
      slug: true,
      name: true,
      nameBn: true,
      parentId: true,
    },
  });

  const childrenByParent = new Map<string | null, typeof rows>();
  for (const r of rows) {
    const key = r.parentId;
    if (!childrenByParent.has(key)) {
      childrenByParent.set(key, []);
    }
    childrenByParent.get(key)!.push(r);
  }

  function build(parentId: string | null): CategoryTreeNode[] {
    const list = childrenByParent.get(parentId) ?? [];
    return list.map((c) => ({
      publicId: c.publicId,
      slug: c.slug,
      name: c.name,
      nameBn: c.nameBn,
      children: build(c.id),
    }));
  }

  return build(null);
}

export type CategoryPublicDetail = {
  publicId: string;
  slug: string;
  name: string;
  nameBn: string | null;
  parentPublicId: string | null;
  attributeDefinitions: CategoryAttributeDef[];
};

export async function getCategoryByPublicId(
  publicId: string
): Promise<CategoryPublicDetail> {
  const c = await prisma.category.findUnique({
    where: { publicId },
    select: {
      publicId: true,
      slug: true,
      name: true,
      nameBn: true,
      attributeSchema: true,
      parent: { select: { publicId: true } },
    },
  });
  if (!c) {
    throw new AppError(404, "Category not found", "NOT_FOUND");
  }
  return {
    publicId: c.publicId,
    slug: c.slug,
    name: c.name,
    nameBn: c.nameBn,
    parentPublicId: c.parent?.publicId ?? null,
    attributeDefinitions: safeParseCategoryAttributeSchema(c.attributeSchema),
  };
}

export async function createCategory(data: {
  slug: string;
  name: string;
  nameBn?: string;
  parentPublicId?: string;
  sortOrder?: number;
  attributeSchema?: unknown;
}) {
  let parentId: string | undefined;
  if (data.parentPublicId) {
    const p = await prisma.category.findUnique({
      where: { publicId: data.parentPublicId },
    });
    if (!p) {
      throw new AppError(400, "Invalid parent category", "BAD_PARENT");
    }
    parentId = p.id;
  }
  let attributeSchema: Prisma.InputJsonValue | undefined;
  if (data.attributeSchema !== undefined) {
    const parsed = parseCategoryAttributeSchemaFromJson(data.attributeSchema);
    attributeSchema =
      parsed.length > 0 ? (parsed as unknown as Prisma.InputJsonValue) : undefined;
  }
  return prisma.category.create({
    data: {
      publicId: newPublicId("cat"),
      slug: data.slug,
      name: data.name,
      nameBn: data.nameBn,
      parentId,
      sortOrder: data.sortOrder ?? 0,
      ...(attributeSchema !== undefined && { attributeSchema }),
    },
  });
}
