import type { Request } from "express";
import { env } from "../config/env.js";

/** Base URL for absolute links returned to the browser (uploads, etc.). */
export function requestPublicBase(req: Request): string {
  const fromEnv = process.env.PUBLIC_API_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  const proto = (
    req.get("x-forwarded-proto") ||
    req.protocol ||
    "http"
  )
    .split(",")[0]!
    .trim();
  const host =
    req.get("x-forwarded-host") || req.get("host") || `127.0.0.1:${env.PORT}`;
  return `${proto}://${host}`;
}
