import { z } from "zod";

export const returnRequestTypeSchema = z.enum(["return", "exchange", "warranty"]);
export const returnRequestStatusSchema = z.enum([
  "requested",
  "approved",
  "rejected",
  "completed",
]);

export const returnRequestCreateSchema = z.object({
  orderPublicId: z.string().min(1),
  type: returnRequestTypeSchema.default("return"),
  reason: z.string().min(1).max(4000),
});

export const returnRequestAdminUpdateSchema = z.object({
  status: returnRequestStatusSchema,
  adminNote: z.string().max(4000).optional(),
});

export const returnRequestAdminListQuerySchema = z.object({
  status: returnRequestStatusSchema.optional(),
});
