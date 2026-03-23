import { z } from "zod";
import { AppError } from "../utils/AppError.js";

export const categoryAttributeDefSchema = z
  .object({
    key: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9_]+$/, "Key: lowercase letters, digits, underscore only"),
    name: z.string().min(1).max(120),
    type: z.enum(["text", "number", "boolean", "select"]),
    required: z.boolean(),
    options: z.array(z.string().min(1).max(200)).max(80).optional(),
  })
  .superRefine((row, ctx) => {
    if (row.type === "select") {
      if (!row.options?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select attributes must include at least one option",
          path: ["options"],
        });
      }
    }
  });

export const categoryAttributeSchemaArraySchema = z
  .array(categoryAttributeDefSchema)
  .max(40)
  .superRefine((arr, ctx) => {
    const seen = new Set<string>();
    for (let i = 0; i < arr.length; i++) {
      const k = arr[i].key;
      if (seen.has(k)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate attribute key: ${k}`,
          path: [i, "key"],
        });
      }
      seen.add(k);
    }
  });

export type CategoryAttributeDef = z.infer<typeof categoryAttributeDefSchema>;

export function parseCategoryAttributeSchemaFromJson(
  raw: unknown
): CategoryAttributeDef[] {
  if (raw == null) {
    return [];
  }
  const parsed = categoryAttributeSchemaArraySchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((e) => e.message).join("; ");
    throw new AppError(
      400,
      msg || "Invalid category attribute schema",
      "BAD_ATTRIBUTE_SCHEMA"
    );
  }
  return parsed.data;
}

const MAX_TEXT_LEN = 4000;

export function validateProductAttributesForCategory(
  defs: CategoryAttributeDef[],
  raw: unknown
): Record<string, string | number | boolean> | null {
  if (defs.length === 0) {
    if (raw == null) {
      return null;
    }
    if (typeof raw === "object" && !Array.isArray(raw)) {
      const keys = Object.keys(raw as object);
      if (keys.length === 0) {
        return null;
      }
    }
    throw new AppError(
      400,
      "This category defines no custom attributes; omit attributes or pass an empty object.",
      "ATTRIBUTE_NOT_ALLOWED"
    );
  }

  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new AppError(400, "Attributes must be a JSON object", "BAD_ATTRIBUTES");
  }

  const input = raw as Record<string, unknown>;
  const out: Record<string, string | number | boolean> = {};

  for (const d of defs) {
    const v = input[d.key];
    const empty =
      v === undefined ||
      v === null ||
      (typeof v === "string" && v.trim() === "");

    if (empty) {
      if (d.required) {
        throw new AppError(
          400,
          `Required attribute missing: ${d.name} (${d.key})`,
          "ATTRIBUTE_REQUIRED"
        );
      }
      continue;
    }

    if (d.type === "text") {
      const s = String(v).trim();
      if (s.length > MAX_TEXT_LEN) {
        throw new AppError(400, `Attribute too long: ${d.name}`, "ATTRIBUTE_TOO_LONG");
      }
      out[d.key] = s;
      continue;
    }

    if (d.type === "number") {
      const n =
        typeof v === "number"
          ? v
          : typeof v === "string"
            ? Number(v)
            : NaN;
      if (!Number.isFinite(n)) {
        throw new AppError(400, `Invalid number for: ${d.name}`, "ATTRIBUTE_TYPE");
      }
      out[d.key] = n;
      continue;
    }

    if (d.type === "boolean") {
      if (typeof v === "boolean") {
        out[d.key] = v;
        continue;
      }
      if (v === "true" || v === "1" || v === 1) {
        out[d.key] = true;
        continue;
      }
      if (v === "false" || v === "0" || v === 0) {
        out[d.key] = false;
        continue;
      }
      throw new AppError(400, `Invalid boolean for: ${d.name}`, "ATTRIBUTE_TYPE");
    }

    if (d.type === "select") {
      const s = String(v).trim();
      const opts = d.options ?? [];
      if (!opts.includes(s)) {
        throw new AppError(
          400,
          `Invalid option for ${d.name}: must be one of allowed values`,
          "ATTRIBUTE_SELECT"
        );
      }
      out[d.key] = s;
    }
  }

  for (const k of Object.keys(input)) {
    if (!defs.some((d) => d.key === k)) {
      throw new AppError(400, `Unknown attribute key: ${k}`, "UNKNOWN_ATTRIBUTE");
    }
  }

  return Object.keys(out).length > 0 ? out : null;
}

/** Lenient parse for DB reads (invalid stored JSON yields empty list). */
export function safeParseCategoryAttributeSchema(
  raw: unknown
): CategoryAttributeDef[] {
  const parsed = categoryAttributeSchemaArraySchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}
