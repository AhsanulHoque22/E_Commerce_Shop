import { z } from "zod";

export const productImageMetaSchema = z.object({
  productPublicId: z.string().min(1),
  kind: z.enum(["main", "gallery"]),
});

export const adBannerMetaSchema = z.object({
  placement: z.string().max(64).optional(),
});

export const brandLogoMetaSchema = z.object({
  brandKey: z.string().min(1).max(191),
});
