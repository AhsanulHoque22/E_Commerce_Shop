import { OrderStatus, ProductStatus } from "@prisma/client";
import { z } from "zod";
import { categoryAttributeSchemaArraySchema } from "../domain/categoryAttributes.js";

export const listAdminProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  category: z.string().max(64).optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  stock: z.enum(["in_stock", "out", "any"]).optional().default("any"),
});

export const adminOrderStatusBodySchema = z.object({
  status: z.nativeEnum(OrderStatus),
  shipmentTrackingId: z.string().max(255).optional(),
  courierName: z.string().max(160).optional(),
  shipmentTrackingUrl: z.string().max(2048).optional(),
  paymentReference: z.string().max(255).optional(),
  paymentStatus: z.string().max(64).optional(),
});

export const adminListOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(OrderStatus).optional(),
  search: z.string().max(200).optional(),
});

export const stockAdjustSchema = z.object({
  delta: z.number().int(),
});

export const adminBrandPutSchema = z
  .object({
    displayName: z.string().min(1).max(128).optional(),
    isActive: z.boolean().optional(),
    logoUrl: z.union([z.string().url(), z.null()]).optional(),
    logoPublicId: z.union([z.string().max(512), z.null()]).optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
  })
  .strict();

export const adminCategoryCreateSchema = z.object({
  slug: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  nameBn: z.string().max(120).optional(),
  parentPublicId: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  attributeSchema: categoryAttributeSchemaArraySchema.optional(),
});

export const adminCategoryUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  nameBn: z.string().max(120).nullable().optional(),
  sortOrder: z.number().int().optional(),
  attributeSchema: categoryAttributeSchemaArraySchema.nullable().optional(),
});
