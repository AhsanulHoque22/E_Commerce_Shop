import { z } from "zod";

export const addressCreateSchema = z.object({
  label: z.string().min(1).max(60).optional(),
  fullName: z.string().min(1).max(160),
  phone: z.string().min(1).max(32),
  line1: z.string().min(1).max(255),
  line2: z.string().max(255).optional(),
  city: z.string().min(1).max(120),
  area: z.string().max(120).optional(),
  postalCode: z.string().max(20).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  isDefault: z.boolean().optional(),
});

export const addressUpdateSchema = addressCreateSchema.partial();
