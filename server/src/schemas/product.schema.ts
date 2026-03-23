import { ProductStatus } from "@prisma/client";
import { z } from "zod";

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
  search: z.string().max(200).optional(),
  category: z.string().max(64).optional(),
  brand: z.string().max(128).optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  featured: z
    .string()
    .optional()
    .transform((v) =>
      v === "true" ? true : v === "false" ? false : undefined
    ),
  hot: z
    .string()
    .optional()
    .transform((v) => (v === "true" ? true : undefined)),
});

export const createProductSchema = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  nameBn: z.string().max(255).optional(),
  description: z.string().min(1),
  shortDesc: z.string().max(500).optional(),
  brand: z.string().max(128).trim().nullish(),
  specs: z.record(z.string(), z.any()).optional(),
  price: z.number().positive(),
  comparePrice: z.number().positive().optional(),
  stock: z.number().int().min(0),
  readyToShip: z.boolean(),
  categoryPublicId: z.string().min(1),
  featured: z.boolean().optional(),
  badgeNew: z.boolean().optional(),
  badgeBestseller: z.boolean().optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  mainImageUrl: z.string().url().optional(),
  mainImagePublicId: z.string().max(512).optional(),
  galleryUrls: z.array(z.object({ url: z.string().url(), publicId: z.string().optional() })).optional(),
  /** Values for the category's dynamic attribute schema */
  attributes: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const updateProductSchema = createProductSchema.partial();
