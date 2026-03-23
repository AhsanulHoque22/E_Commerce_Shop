import type { ZodTypeAny } from "zod";
import { ZodError } from "zod";
import type { z } from "zod";
import { AppError } from "./AppError.js";

export function parseBody<S extends ZodTypeAny>(schema: S, body: unknown): z.infer<S> {
  try {
    return schema.parse(body) as z.infer<S>;
  } catch (e) {
    if (e instanceof ZodError) {
      const msg = e.errors.map((x) => x.message).join(", ");
      throw new AppError(400, msg || "Validation failed", "VALIDATION");
    }
    throw e;
  }
}

export function parseQuery<S extends ZodTypeAny>(schema: S, query: unknown): z.infer<S> {
  try {
    return schema.parse(query) as z.infer<S>;
  } catch (e) {
    if (e instanceof ZodError) {
      const msg = e.errors.map((x) => x.message).join(", ");
      throw new AppError(400, msg || "Invalid query", "VALIDATION");
    }
    throw e;
  }
}
