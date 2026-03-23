import { z } from "zod";

export const cartItemSchema = z.object({
  productPublicId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
});

export const cartUpdateSchema = z.object({
  productPublicId: z.string().min(1),
  quantity: z.number().int().min(0).max(99),
});
