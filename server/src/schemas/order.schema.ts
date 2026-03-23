import { z } from "zod";

export const shippingSchema = z.object({
  fullName: z.string().min(1).max(200),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(120),
  district: z.string().min(1).max(120),
  postalCode: z.string().max(32).optional(),
  country: z.string().min(1).max(120),
});

export const checkoutSchema = z.object({
  shipping: shippingSchema,
  contactEmail: z.string().email(),
  contactPhone: z.string().max(32).optional(),
  paymentMethod: z.enum(["mock_card", "mock_wallet"]),
  notes: z.string().max(2000).optional(),
});

/** @deprecated Use admin routes + adminOrderStatusBodySchema */
export const orderStatusSchema = z.object({
  status: z.enum([
    "PENDING_APPROVAL",
    "APPROVED",
    "PAYMENT_PENDING",
    "PAID",
    "SHIPPED",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "COMPLETED",
    "CANCELLED",
  ]),
});
