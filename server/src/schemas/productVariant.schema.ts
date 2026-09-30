import { z } from "zod";

const variantOptionsSchema = z
  .record(z.string().min(1), z.string().min(1))
  .refine((o) => Object.keys(o).length > 0, {
    message: "options must include at least one key",
  });

export const createProductVariantSchema = z.object({
  sku: z.string().min(1).max(64),
  options: variantOptionsSchema,
  price: z.number().nonnegative(),
  comparePrice: z.number().nonnegative().optional(),
  stock: z.number().int().min(0),
  isDefault: z.boolean().optional(),
  mainImageUrl: z.string().url().optional(),
  mainImagePublicId: z.string().max(512).optional(),
  sortOrder: z.number().int().optional(),
});

export const updateProductVariantSchema = createProductVariantSchema.partial();

export type CreateProductVariantInput = z.infer<typeof createProductVariantSchema>;
export type UpdateProductVariantInput = z.infer<typeof updateProductVariantSchema>;
