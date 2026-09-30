import { z } from "zod";

export const couponValidateSchema = z.object({
  code: z.string().min(1).max(40),
  subtotal: z.number().nonnegative(),
});

export const couponCreateSchema = z.object({
  code: z.string().min(1).max(40),
  description: z.string().max(255).optional(),
  discountType: z.enum(["percent", "fixed"]),
  discountValue: z.number().positive(),
  minSubtotal: z.number().nonnegative().optional(),
  maxDiscount: z.number().positive().optional(),
  usageLimit: z.number().int().positive().optional(),
  perUserLimit: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
});

export const couponUpdateSchema = couponCreateSchema.partial();
