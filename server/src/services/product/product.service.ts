import { Prisma, ProductStatus, type Product } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import {
  safeParseCategoryAttributeSchema,
  validateProductAttributesForCategory,
} from "../../domain/categoryAttributes.js";
import { AppError } from "../../utils/AppError.js";
import { newPublicId } from "../../utils/ids.js";
import { statusAfterStockChange } from "../admin/productStatus.util.js";

export type ProductListParams = {
  page: number;
  limit: number;
  search?: string;
  categoryPublicId?: string;
  minPrice?: number;
  maxPrice?: number;
  featured?: boolean;
  brand?: string;
};

export type ProductAdminListParams = {
  page: number;
  limit: number;
  search?: string;
  categoryPublicId?: string;
  status?: ProductStatus;
  stockFilter?: "in_stock" | "out" | "any";
};

function decimalToString(d: Prisma.Decimal): string {
  return d.toString();
}

function parseGalleryUrls(raw: unknown): string[] {
  if (raw == null) {
    return [];
  }
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((x): x is string => typeof x === "string" && x.length > 0);
}

function normalizeProductAttributes(
  raw: unknown
): Record<string, string | number | boolean> | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

export const storefrontWhere: Prisma.ProductWhereInput = {
  status: { not: ProductStatus.DISCONTINUED },
};

/** Category id + every descendant (subcategory) id, for tree-style filtering. */
async function categoryIdsIncludingDescendants(
  categoryPublicId: string
): Promise<string[] | null> {
  const root = await prisma.category.findUnique({
    where: { publicId: categoryPublicId },
    select: { id: true },
  });
  if (!root) {
    return null;
  }
  const all = await prisma.category.findMany({
    select: { id: true, parentId: true },
  });
  const byParent = new Map<string | null, string[]>();
  for (const c of all) {
    const p = c.parentId;
    if (!byParent.has(p)) {
      byParent.set(p, []);
    }
    byParent.get(p)!.push(c.id);
  }
  const ids: string[] = [];
  const stack = [root.id];
  while (stack.length > 0) {
    const id = stack.pop()!;
    ids.push(id);
    const kids = byParent.get(id) ?? [];
    for (const k of kids) {
      stack.push(k);
    }
  }
  return ids;
}

export async function getProductFacets() {
  const [agg, brandRows] = await Promise.all([
    prisma.product.aggregate({
      where: storefrontWhere,
      _min: { price: true },
      _max: { price: true },
    }),
    prisma.product.findMany({
      where: {
        ...storefrontWhere,
        brand: { not: null },
      },
      select: { brand: true },
      distinct: ["brand"],
      orderBy: { brand: "asc" },
    }),
  ]);
  const priceMin = agg._min.price != null ? Number(agg._min.price) : 0;
  const priceMax = agg._max.price != null ? Number(agg._max.price) : 0;
  const brands = brandRows
    .map((r) => r.brand)
    .filter((b): b is string => Boolean(b && String(b).trim()));
  return { priceMin, priceMax, brands };
}

export async function listProducts(params: ProductListParams) {
  const skip = (params.page - 1) * params.limit;
  const where: Prisma.ProductWhereInput = { ...storefrontWhere };

  if (params.search) {
    const q = params.search;
    where.OR = [
      { name: { contains: q } },
      { nameBn: { contains: q } },
      { shortDesc: { contains: q } },
      { description: { contains: q } },
      { sku: { contains: q } },
    ];
  }
  if (params.categoryPublicId) {
    const ids = await categoryIdsIncludingDescendants(params.categoryPublicId);
    if (!ids || ids.length === 0) {
      where.categoryId = { in: [] };
    } else {
      where.categoryId = { in: ids };
    }
  }
  if (params.brand?.trim()) {
    where.brand = params.brand.trim();
  }
  if (params.featured !== undefined) {
    where.featured = params.featured;
  }
  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    where.price = {};
    if (params.minPrice !== undefined) {
      where.price.gte = params.minPrice;
    }
    if (params.maxPrice !== undefined) {
      where.price.lte = params.maxPrice;
    }
  }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: params.limit,
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { publicId: true, name: true, slug: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items: items.map((p) => mapProductSummary(p)),
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
  };
}

/**
 * Products customers engage with most: each favorite row counts 1;
 * cart rows add their quantity (same product in multiple carts sums up).
 */
export async function listHotProducts(limit: number) {
  const [favGroups, cartGroups] = await Promise.all([
    prisma.favorite.groupBy({
      by: ["productId"],
      _count: { productId: true },
    }),
    prisma.cartItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
    }),
  ]);

  const score = new Map<string, number>();
  for (const f of favGroups) {
    score.set(f.productId, (score.get(f.productId) ?? 0) + f._count.productId);
  }
  for (const c of cartGroups) {
    const q = c._sum.quantity ?? 0;
    score.set(c.productId, (score.get(c.productId) ?? 0) + q);
  }

  const rankedIds = [...score.entries()]
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  if (rankedIds.length === 0) {
    return {
      items: [],
      total: 0,
      page: 1,
      limit,
      totalPages: 0,
    };
  }

  const candidateIds = rankedIds.slice(0, Math.min(rankedIds.length, limit * 6));

  const rows = await prisma.product.findMany({
    where: {
      id: { in: candidateIds },
      ...storefrontWhere,
    },
    include: {
      category: { select: { publicId: true, name: true, slug: true } },
    },
  });

  const orderIndex = new Map(candidateIds.map((id, i) => [id, i]));
  rows.sort((a, b) => orderIndex.get(a.id)! - orderIndex.get(b.id)!);

  const picked = rows.slice(0, limit);

  return {
    items: picked.map((p) => mapProductSummary(p)),
    total: picked.length,
    page: 1,
    limit,
    totalPages: 1,
  };
}

export async function getProductByPublicId(publicId: string) {
  const p = await prisma.product.findFirst({
    where: { publicId, ...storefrontWhere },
    include: {
      category: {
        select: {
          publicId: true,
          name: true,
          nameBn: true,
          slug: true,
          attributeSchema: true,
          parent: { select: { name: true, slug: true, publicId: true } },
        },
      },
    },
  });
  if (!p) {
    throw new AppError(404, "Product not found", "NOT_FOUND");
  }
  return mapProductDetail(p);
}

export async function createProduct(
  data: {
    sku: string;
    name: string;
    nameBn?: string;
    description: string;
    shortDesc?: string;
    brand?: string | null;
    specs?: Prisma.InputJsonValue;
    price: number;
    comparePrice?: number;
    stock: number;
    readyToShip: boolean;
    categoryPublicId: string;
    status?: ProductStatus;
    featured?: boolean;
    badgeNew?: boolean;
    badgeBestseller?: boolean;
    mainImageUrl?: string;
    mainImagePublicId?: string;
    galleryUrls?: Prisma.InputJsonValue;
    attributes?: unknown | null;
  },
  actorUserId: string
) {
  const cat = await prisma.category.findUnique({
    where: { publicId: data.categoryPublicId },
  });
  if (!cat) {
    throw new AppError(400, "Invalid category", "BAD_CATEGORY");
  }
  const defs = safeParseCategoryAttributeSchema(cat.attributeSchema);
  const attrInput =
    data.attributes === null || data.attributes === undefined
      ? {}
      : data.attributes;
  const validatedAttrs = validateProductAttributesForCategory(defs, attrInput);
  const initialStatus =
    data.status ??
    statusAfterStockChange(data.stock, ProductStatus.ACTIVE);
  const product = await prisma.product.create({
    data: {
      publicId: newPublicId("prod"),
      sku: data.sku,
      name: data.name,
      nameBn: data.nameBn,
      description: data.description,
      shortDesc: data.shortDesc,
      brand: data.brand?.trim() ? data.brand.trim() : undefined,
      specs: data.specs ?? undefined,
      attributes:
        validatedAttrs === null
          ? Prisma.DbNull
          : (validatedAttrs as Prisma.InputJsonValue),
      price: data.price,
      comparePrice: data.comparePrice,
      stock: data.stock,
      readyToShip: data.readyToShip,
      status: initialStatus,
      categoryId: cat.id,
      featured: data.featured ?? false,
      badgeNew: data.badgeNew ?? false,
      badgeBestseller: data.badgeBestseller ?? false,
      mainImageUrl: data.mainImageUrl,
      mainImagePublicId: data.mainImagePublicId,
      galleryUrls: data.galleryUrls ?? undefined,
    },
    include: {
      category: { include: { parent: { select: { name: true, slug: true, publicId: true } } } },
    },
  });
  await prisma.auditLog.create({
    data: {
      action: "admin.product.create",
      entityType: "product",
      entityId: product.publicId,
      userId: actorUserId,
      metadata: { sku: product.sku } as object,
    },
  });
  return mapProductDetail(product as ProductDetailRow);
}

export async function updateProduct(
  publicId: string,
  data: Partial<{
    name: string;
    nameBn: string | null;
    description: string;
    shortDesc: string | null;
    brand: string | null;
    specs: Prisma.InputJsonValue | null;
    price: number;
    comparePrice: number | null;
    stock: number;
    readyToShip: boolean;
    categoryPublicId: string;
    status: ProductStatus;
    featured: boolean;
    badgeNew: boolean;
    badgeBestseller: boolean;
    mainImageUrl: string | null;
    mainImagePublicId: string | null;
    galleryUrls: Prisma.InputJsonValue | null;
    attributes: unknown | null;
  }>,
  actorUserId: string
) {
  const existing = await prisma.product.findUnique({
    where: { publicId },
    include: {
      category: { select: { id: true, publicId: true, attributeSchema: true } },
    },
  });
  if (!existing) {
    throw new AppError(404, "Product not found", "NOT_FOUND");
  }
  let categoryId = existing.categoryId;
  if (data.categoryPublicId) {
    const cat = await prisma.category.findUnique({
      where: { publicId: data.categoryPublicId },
    });
    if (!cat) {
      throw new AppError(400, "Invalid category", "BAD_CATEGORY");
    }
    categoryId = cat.id;
  }
  const nextCat = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { attributeSchema: true, publicId: true },
  });
  if (!nextCat) {
    throw new AppError(400, "Invalid category", "BAD_CATEGORY");
  }
  const defs = safeParseCategoryAttributeSchema(nextCat.attributeSchema);
  const categoryChanged =
    data.categoryPublicId !== undefined &&
    data.categoryPublicId !== existing.category.publicId;

  let validatedAttrs: Record<string, string | number | boolean> | null | undefined =
    undefined;
  if (data.attributes !== undefined) {
    const raw = data.attributes === null ? {} : data.attributes;
    validatedAttrs = validateProductAttributesForCategory(defs, raw);
  } else if (categoryChanged) {
    validatedAttrs = validateProductAttributesForCategory(defs, {});
  }

  let nextStatus = data.status;
  if (data.stock !== undefined && data.status === undefined) {
    nextStatus = statusAfterStockChange(data.stock, existing.status);
  }
  const product = await prisma.product.update({
    where: { publicId },
    include: {
      category: { include: { parent: { select: { name: true, slug: true, publicId: true } } } },
    },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.nameBn !== undefined && { nameBn: data.nameBn }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.shortDesc !== undefined && { shortDesc: data.shortDesc }),
      ...(data.brand !== undefined && {
        brand: data.brand?.trim() ? data.brand.trim() : null,
      }),
      ...(data.specs !== undefined && { specs: data.specs ?? undefined }),
      ...(data.price !== undefined && { price: data.price }),
      ...(data.comparePrice !== undefined && {
        comparePrice: data.comparePrice ?? undefined,
      }),
      ...(data.stock !== undefined && { stock: data.stock }),
      ...(nextStatus !== undefined && { status: nextStatus }),
      ...(data.readyToShip !== undefined && { readyToShip: data.readyToShip }),
      categoryId,
      ...(data.featured !== undefined && { featured: data.featured }),
      ...(data.badgeNew !== undefined && { badgeNew: data.badgeNew }),
      ...(data.badgeBestseller !== undefined && {
        badgeBestseller: data.badgeBestseller,
      }),
      ...(data.mainImageUrl !== undefined && {
        mainImageUrl: data.mainImageUrl ?? undefined,
      }),
      ...(data.mainImagePublicId !== undefined && {
        mainImagePublicId: data.mainImagePublicId ?? undefined,
      }),
      ...(data.galleryUrls !== undefined && {
        galleryUrls: data.galleryUrls ?? undefined,
      }),
      ...(validatedAttrs !== undefined && {
        attributes:
          validatedAttrs === null
            ? Prisma.DbNull
            : (validatedAttrs as Prisma.InputJsonValue),
      }),
    },
  });
  await prisma.auditLog.create({
    data: {
      action: "admin.product.update",
      entityType: "product",
      entityId: product.publicId,
      userId: actorUserId,
      metadata: { fields: Object.keys(data) } as object,
    },
  });
  return mapProductDetail(product as ProductDetailRow);
}

export async function deleteProductSoft(publicId: string, actorUserId: string) {
  const existing = await prisma.product.findUnique({ where: { publicId } });
  if (!existing) {
    throw new AppError(404, "Product not found", "NOT_FOUND");
  }
  await prisma.product.update({
    where: { publicId },
    data: { status: ProductStatus.DISCONTINUED },
  });
  await prisma.auditLog.create({
    data: {
      action: "admin.product.discontinue",
      entityType: "product",
      entityId: publicId,
      userId: actorUserId,
    },
  });
}

export async function adjustProductStock(
  publicId: string,
  delta: number,
  actorUserId: string
) {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new AppError(400, "delta must be a non-zero integer", "VALIDATION");
  }
  const existing = await prisma.product.findUnique({ where: { publicId } });
  if (!existing) {
    throw new AppError(404, "Product not found", "NOT_FOUND");
  }
  if (existing.status === ProductStatus.DISCONTINUED) {
    throw new AppError(400, "Cannot adjust stock for discontinued product", "BAD_STATUS");
  }
  const nextStock = existing.stock + delta;
  if (nextStock < 0) {
    throw new AppError(400, "Stock cannot be negative", "VALIDATION");
  }
  const nextStatus = statusAfterStockChange(nextStock, existing.status);
  const product = await prisma.product.update({
    where: { publicId },
    data: { stock: nextStock, status: nextStatus },
    include: {
      category: { include: { parent: { select: { name: true, slug: true, publicId: true } } } },
    },
  });
  await prisma.auditLog.create({
    data: {
      action: "admin.product.stock",
      entityType: "product",
      entityId: publicId,
      userId: actorUserId,
      metadata: { delta, stockAfter: nextStock } as object,
    },
  });
  return mapProductDetail(product as ProductDetailRow);
}

export async function listProductsAdmin(params: ProductAdminListParams) {
  const skip = (params.page - 1) * params.limit;
  const where: Prisma.ProductWhereInput = {};

  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [
      { name: { contains: q } },
      { sku: { contains: q } },
      { description: { contains: q } },
    ];
  }
  if (params.categoryPublicId) {
    where.category = { publicId: params.categoryPublicId };
  }
  if (params.status) {
    where.status = params.status;
  }
  if (params.stockFilter === "in_stock") {
    where.stock = { gt: 0 };
  }
  if (params.stockFilter === "out") {
    where.stock = { lte: 0 };
  }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: params.limit,
      orderBy: { updatedAt: "desc" },
      include: {
        category: { select: { publicId: true, name: true, slug: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items: items.map((p) => ({
      ...mapProductSummary(p),
      status: p.status,
      lowStock:
        p.stock > 0 && p.stock <= env.LOW_STOCK_THRESHOLD,
    })),
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
    lowStockThreshold: env.LOW_STOCK_THRESHOLD,
  };
}

export async function getProductAdminByPublicId(publicId: string) {
  const p = await prisma.product.findUnique({
    where: { publicId },
    include: {
      category: {
        select: {
          publicId: true,
          name: true,
          nameBn: true,
          slug: true,
          attributeSchema: true,
          parent: { select: { name: true, slug: true, publicId: true } },
        },
      },
    },
  });
  if (!p) {
    throw new AppError(404, "Product not found", "NOT_FOUND");
  }
  return {
    ...mapProductDetail(p as ProductDetailRow),
    status: p.status,
    sku: p.sku,
  };
}

function mapProductSummary(p: {
  publicId: string;
  sku: string;
  name: string;
  shortDesc: string | null;
  brand: string | null;
  price: Prisma.Decimal;
  stock: number;
  readyToShip: boolean;
  mainImageUrl: string | null;
  featured: boolean;
  badgeNew: boolean;
  badgeBestseller: boolean;
  category: { publicId: string; name: string; slug: string };
}) {
  return {
    publicId: p.publicId,
    sku: p.sku,
    name: p.name,
    brand: p.brand,
    shortDescription: p.shortDesc,
    price: decimalToString(p.price),
    stock: p.stock,
    readyToShip: p.readyToShip,
    inStock: p.stock > 0,
    mainImageUrl: p.mainImageUrl,
    featured: p.featured,
    badges: {
      new: p.badgeNew,
      bestseller: p.badgeBestseller,
      limitedStock: p.stock > 0 && p.stock <= env.LOW_STOCK_THRESHOLD,
    },
    category: p.category,
  };
}

type ProductDetailRow = Product & {
  category: {
    publicId: string;
    name: string;
    nameBn: string | null;
    slug: string;
    attributeSchema: unknown;
    parent: {
      publicId: string;
      name: string;
      slug: string;
    } | null;
  };
};

function mapProductDetail(p: ProductDetailRow) {
  return {
    publicId: p.publicId,
    sku: p.sku,
    status: p.status,
    name: p.name,
    nameBn: p.nameBn,
    brand: p.brand,
    description: p.description,
    shortDesc: p.shortDesc,
    specs: p.specs,
    attributes: normalizeProductAttributes(p.attributes),
    price: decimalToString(p.price),
    comparePrice: p.comparePrice ? decimalToString(p.comparePrice) : null,
    stock: p.stock,
    readyToShip: p.readyToShip,
    inStock: p.stock > 0,
    mainImageUrl: p.mainImageUrl,
    mainImagePublicId: p.mainImagePublicId,
    galleryUrls: parseGalleryUrls(p.galleryUrls),
    featured: p.featured,
    badges: {
      new: p.badgeNew,
      bestseller: p.badgeBestseller,
      limitedStock: p.stock > 0 && p.stock <= env.LOW_STOCK_THRESHOLD,
    },
    category: {
      publicId: p.category.publicId,
      name: p.category.name,
      nameBn: p.category.nameBn,
      slug: p.category.slug,
      parent: p.category.parent,
      attributeDefinitions: safeParseCategoryAttributeSchema(
        p.category.attributeSchema
      ),
    },
  };
}
