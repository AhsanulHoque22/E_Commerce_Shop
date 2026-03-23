import { ProductStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { normalizeBrandKey } from "../../utils/brandKey.js";

const inStockWhere = {
  stock: { gt: 0 },
  status: { not: ProductStatus.DISCONTINUED },
  brand: { not: null },
} as const;

export type InStockBrandAggregate = {
  brandKey: string;
  productBrandLabel: string;
  productCount: number;
};

export async function aggregateInStockBrands(): Promise<InStockBrandAggregate[]> {
  const groups = await prisma.product.groupBy({
    by: ["brand"],
    where: inStockWhere,
    _count: { _all: true },
  });

  const rows = groups.filter(
    (g): g is { brand: string; _count: { _all: number } } =>
      typeof g.brand === "string" && g.brand.trim().length > 0
  );

  const merged = new Map<
    string,
    { labels: Set<string>; productCount: number }
  >();

  for (const g of rows) {
    const label = g.brand.trim();
    const key = normalizeBrandKey(label);
    let acc = merged.get(key);
    if (!acc) {
      acc = { labels: new Set<string>(), productCount: 0 };
      merged.set(key, acc);
    }
    acc.labels.add(label);
    acc.productCount += g._count._all;
  }

  return [...merged.entries()].map(([brandKey, acc]) => {
    const productBrandLabel = [...acc.labels].sort((a, b) =>
      a.localeCompare(b)
    )[0];
    return {
      brandKey,
      productBrandLabel,
      productCount: acc.productCount,
    };
  });
}

export async function listAdminInventoryBrands() {
  const base = await aggregateInStockBrands();
  if (base.length === 0) {
    return [];
  }
  const keys = base.map((b) => b.brandKey);
  const shopRows = await prisma.shopBrand.findMany({
    where: { brandKey: { in: keys } },
  });
  const byKey = new Map(shopRows.map((s) => [s.brandKey, s]));

  return base
    .map((b) => {
      const s = byKey.get(b.brandKey);
      return {
        brandKey: b.brandKey,
        productBrandLabel: b.productBrandLabel,
        productCount: b.productCount,
        displayName: s?.displayName ?? b.productBrandLabel,
        logoUrl: s?.logoUrl ?? null,
        logoPublicId: s?.logoPublicId ?? null,
        isActive: s?.isActive ?? true,
        sortOrder: s?.sortOrder ?? 0,
      };
    })
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.displayName.localeCompare(b.displayName);
    });
}

export async function upsertShopBrand(
  rawKey: string,
  input: {
    displayName?: string;
    isActive?: boolean;
    logoUrl?: string | null;
    logoPublicId?: string | null;
    sortOrder?: number;
  }
) {
  const brandKey = normalizeBrandKey(decodeURIComponent(rawKey));
  if (!brandKey) {
    throw new AppError(400, "Invalid brand key", "VALIDATION");
  }

  const inventory = await aggregateInStockBrands();
  const inv = inventory.find((b) => b.brandKey === brandKey);
  if (!inv) {
    throw new AppError(
      404,
      "No in-stock products for this brand",
      "BRAND_NOT_IN_STOCK"
    );
  }

  const displayName =
    input.displayName !== undefined
      ? input.displayName.trim() || inv.productBrandLabel
      : undefined;

  return prisma.shopBrand.upsert({
    where: { brandKey },
    create: {
      brandKey,
      displayName: displayName ?? inv.productBrandLabel,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
      logoUrl: input.logoUrl ?? null,
      logoPublicId: input.logoPublicId ?? null,
    },
    update: {
      ...(displayName !== undefined ? { displayName } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
      ...(input.logoPublicId !== undefined
        ? { logoPublicId: input.logoPublicId }
        : {}),
    },
  });
}

export async function assertBrandKeyInInventory(brandKeyRaw: string): Promise<void> {
  const brandKey = normalizeBrandKey(decodeURIComponent(brandKeyRaw));
  if (!brandKey) {
    throw new AppError(400, "Invalid brand key", "VALIDATION");
  }
  const inventory = await aggregateInStockBrands();
  if (!inventory.some((b) => b.brandKey === brandKey)) {
    throw new AppError(
      404,
      "No in-stock products for this brand",
      "BRAND_NOT_IN_STOCK"
    );
  }
}

export function sanitizeBrandFolderSegment(brandKey: string): string {
  const s = normalizeBrandKey(brandKey)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
  return s || "brand";
}

export type ShowcaseBrandItem = {
  brandKey: string;
  displayName: string;
  logoUrl: string;
  filterBrand: string;
};

export async function listShowcaseBrandsPublic(): Promise<{
  items: ShowcaseBrandItem[];
}> {
  const inventory = await aggregateInStockBrands();
  if (inventory.length === 0) {
    return { items: [] };
  }

  const keys = inventory.map((b) => b.brandKey);
  const shopRows = await prisma.shopBrand.findMany({
    where: {
      brandKey: { in: keys },
      isActive: true,
    },
    orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
  });

  const invByKey = new Map(inventory.map((b) => [b.brandKey, b]));

  const items: ShowcaseBrandItem[] = [];
  for (const s of shopRows) {
    const url = s.logoUrl?.trim();
    if (!url) {
      continue;
    }
    const inv = invByKey.get(s.brandKey);
    if (!inv) {
      continue;
    }
    items.push({
      brandKey: s.brandKey,
      displayName: s.displayName,
      logoUrl: url,
      filterBrand: inv.productBrandLabel,
    });
  }

  return { items };
}
