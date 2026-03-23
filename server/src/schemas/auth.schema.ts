import { z } from "zod";

const addressSchema = z.object({
  formatted: z.string().min(3).max(2000),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
});

export const registerSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    phone: z.string().min(8).max(32),
    otpCode: z.string().regex(/^\d{6}$/),
    firstName: z.string().max(120).optional(),
    lastName: z.string().max(120).optional(),
    consent: z.boolean(),
    sameAsPermanentForPresent: z.boolean(),
    samePresentForDelivery: z.boolean(),
    permanentAddress: addressSchema,
    presentAddress: addressSchema.optional(),
    deliveryAddress: addressSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.sameAsPermanentForPresent && !data.presentAddress) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Present address is required",
        path: ["presentAddress"],
      });
    }
    if (!data.samePresentForDelivery && !data.deliveryAddress) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Delivery address is required",
        path: ["deliveryAddress"],
      });
    }
  });

/** Accepts `identifier` or legacy/autofill `email` for the same field. */
export const loginSchema = z
  .object({
    identifier: z.string().optional(),
    email: z.string().optional(),
    password: z.string().optional(),
  })
  .transform((d) => ({
    identifier: String(d.identifier ?? d.email ?? "").trim(),
    password: d.password ?? "",
  }))
  .pipe(
    z.object({
      identifier: z
        .string()
        .min(3, "Enter your email or phone number"),
      password: z.string().min(1, "Password is required"),
    })
  );

export const otpRequestSchema = z.object({
  phone: z.string().min(8).max(32),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
});

export const googleAuthSchema = z.object({
  idToken: z.string().min(10),
});

export const facebookAuthSchema = z.object({
  accessToken: z.string().min(10),
});
