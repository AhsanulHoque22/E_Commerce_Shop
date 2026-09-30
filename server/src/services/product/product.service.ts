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
  /** Category-defined attribute key/value filters, e.g. { ram: "6GB" }. */
  attributes?: Record<string, string>;
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

type VariantForSummary = {
  price: Prisma.Decimal;
  comparePrice: Prisma.Decimal | null;
  stock: number;
};

/**
 * A variant-bearing product is sold by variant: its own price/stock/comparePrice
 * columns are stale fallbacks. This computes the storefront-facing numbers
 * (lowest price for "from $X", summed stock, comparePrice of the cheapest
 * variant) from the ProductVariant rows instead. Returns null for products
 * with no variants, so callers fall back to the product's own columns.
 */
function summarizeVariants(
  variants: VariantForSummary[]
): { price: string; comparePrice: string | null; stock: number; inStock: boolean } | null {
  if (variants.length === 0) {
    return null;
  }
  let cheapest = variants[0]!;
  let stock = 0;
  for (const v of variants) {
    stock += v.stock;
    if (Number(v.price) < Number(cheapest.price)) {
      cheapest = v;
    }
  }
  return {
    price: decimalToString(cheapest.price),
    comparePrice: cheapest.comparePrice ? decimalToString(cheapest.comparePrice) : null,
    stock,
    inStock: stock > 0,
  };
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

/** Optionally scoped to one category (+ its descendants) so attribute facets only show relevant keys. */
export async function getProductFacets(categoryPublicId?: string) {
  const categoryScope: Prisma.ProductWhereInput = {};
  if (categoryPublicId) {
    const ids = await categoryIdsIncludingDescendants(categoryPublicId);
    categoryScope.categoryId = { in: ids ?? [] };
  }
  const scopedWhere: Prisma.ProductWhereInput = { ...storefrontWhere, ...categoryScope };

  const [agg, brandRows, attrRows] = await Promise.all([
    prisma.product.aggregate({
      where: scopedWhere,
      _min: { price: true },
      _max: { price: true },
    }),
    prisma.product.findMany({
      where: { ...scopedWhere, brand: { not: null } },
      select: { brand: true },
      distinct: ["brand"],
      orderBy: { brand: "asc" },
    }),
    prisma.product.findMany({
      where: scopedWhere,
      select: { attributes: true },
    }),
  ]);
  const priceMin = agg._min.price != null ? Number(agg._min.price) : 0;
  const priceMax = agg._max.price != null ? Number(agg._max.price) : 0;
  const brands = brandRows
    .map((r) => r.brand)
    .filter((b): b is string => Boolean(b && String(b).trim()));

  const attributeFacets: Record<string, string[]> = {};
  for (const row of attrRows) {
    const attrs = normalizeProductAttributes(row.attributes);
    if (!attrs) {
      continue;
    }
    for (const [key, value] of Object.entries(attrs)) {
      const str = String(value);
      const values = (attributeFacets[key] ??= []);
      if (!values.includes(str)) {
        values.push(str);
      }
    }
  }
  for (const values of Object.values(attributeFacets)) {
    values.sort();
  }

  return { priceMin, priceMax, brands, attributeFacets };
}

export async function listProducts(params: ProductListParams) {
  const skip = (params.page - 1) * params.limit;
  const where: Prisma.ProductWhereInput = { ...storefrontWhere };

  if (params.search) {
    const q = params.search;
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { nameBn: { contains: q, mode: "insensitive" } },
      { shortDesc: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
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
  if (params.attributes) {
    const clauses: Prisma.ProductWhereInput[] = Object.entries(params.attributes)
      .filter(([key, value]) => key && value)
      .map(([key, value]) => ({
        attributes: { path: [key], equals: value },
      }));
    if (clauses.length > 0) {
      where.AND = clauses;
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
        variants: { select: { price: true, comparePrice: true, stock: true } },
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
      variants: { select: { price: true, comparePrice: true, stock: true } },
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
      variants: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!p) {
    throw new AppError(404, "Product not found", "NOT_FOUND");
  }
  return mapProductDetail(p, p.variants);
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
      { name: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
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
        variants: { select: { price: true, comparePrice: true, stock: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items: items.map((p) => {
      const summary = mapProductSummary(p);
      return {
        ...summary,
        status: p.status,
        lowStock: summary.stock > 0 && summary.stock <= env.LOW_STOCK_THRESHOLD,
      };
    }),
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
  variants?: VariantForSummary[];
}) {
  const variantSummary = p.variants?.length ? summarizeVariants(p.variants) : null;
  const price = variantSummary ? variantSummary.price : decimalToString(p.price);
  const stock = variantSummary ? variantSummary.stock : p.stock;
  const inStock = variantSummary ? variantSummary.inStock : p.stock > 0;
  return {
    publicId: p.publicId,
    sku: p.sku,
    name: p.name,
    brand: p.brand,
    shortDescription: p.shortDesc,
    price,
    stock,
    readyToShip: p.readyToShip,
    inStock,
    hasVariants: Boolean(variantSummary),
    mainImageUrl: p.mainImageUrl,
    featured: p.featured,
    badges: {
      new: p.badgeNew,
      bestseller: p.badgeBestseller,
      limitedStock: stock > 0 && stock <= env.LOW_STOCK_THRESHOLD,
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

type ProductVariantRow = {
  publicId: string;
  options: Prisma.JsonValue;
  price: Prisma.Decimal;
  comparePrice: Prisma.Decimal | null;
  stock: number;
  mainImageUrl: string | null;
};

function mapProductDetail(p: ProductDetailRow, variants: ProductVariantRow[] = []) {
  const variantSummary = summarizeVariants(variants);
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
    price: variantSummary ? variantSummary.price : decimalToString(p.price),
    comparePrice: variantSummary
      ? variantSummary.comparePrice
      : p.comparePrice
        ? decimalToString(p.comparePrice)
        : null,
    stock: variantSummary ? variantSummary.stock : p.stock,
    readyToShip: p.readyToShip,
    inStock: variantSummary ? variantSummary.inStock : p.stock > 0,
    mainImageUrl: p.mainImageUrl,
    mainImagePublicId: p.mainImagePublicId,
    galleryUrls: parseGalleryUrls(p.galleryUrls),
    featured: p.featured,
    badges: {
      new: p.badgeNew,
      bestseller: p.badgeBestseller,
      limitedStock:
        (variantSummary ? variantSummary.stock : p.stock) > 0 &&
        (variantSummary ? variantSummary.stock : p.stock) <= env.LOW_STOCK_THRESHOLD,
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
    hasVariants: variants.length > 0,
    variants: variants.map((v) => ({
      publicId: v.publicId,
      options: v.options,
      price: decimalToString(v.price),
      comparePrice: v.comparePrice ? decimalToString(v.comparePrice) : null,
      stock: v.stock,
      mainImageUrl: v.mainImageUrl,
    })),
  };
}
