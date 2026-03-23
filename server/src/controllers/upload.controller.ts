import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { uploadImageBuffer } from "../services/cloudinary/cloudinaryUpload.service.js";
import { requestPublicBase } from "../utils/requestPublicBase.js";
import {
  adBannerMetaSchema,
  brandLogoMetaSchema,
  productImageMetaSchema,
} from "../schemas/upload.schema.js";
import { parseBody } from "../utils/validate.js";
import { sendSuccess } from "../utils/response.js";
import { AppError } from "../utils/AppError.js";
import {
  assertBrandKeyInInventory,
  sanitizeBrandFolderSegment,
} from "../services/brand/shopBrand.service.js";

/** Multer puts non-file fields in req.body as strings */
function parseMultipartJson<T>(raw: unknown, schema: import("zod").ZodType<T>): T {
  if (typeof raw === "string") {
    try {
      return parseBody(schema, JSON.parse(raw));
    } catch {
      throw new AppError(400, "Invalid metadata JSON", "VALIDATION");
    }
  }
  return parseBody(schema, raw);
}

export async function productImage(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file?.buffer) {
    throw new AppError(400, "File is required", "VALIDATION");
  }
  const meta = parseMultipartJson(req.body.metadata, productImageMetaSchema);
  const uuid = randomUUID().replace(/-/g, "");
  const segment =
    meta.kind === "main" ? `main-${uuid}` : `gallery-${uuid}`;
  const publicId = `products/${meta.productPublicId}/${segment}`;
  const result = await uploadImageBuffer({
    buffer: file.buffer,
    publicId,
    publicBaseUrl: requestPublicBase(req),
  });
  sendSuccess(res, {
    url: result.url,
    publicId: result.publicId,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
    variants: result.variants,
  });
}

export async function adBanner(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file?.buffer) {
    throw new AppError(400, "File is required", "VALIDATION");
  }
  const meta = req.body.metadata
    ? parseMultipartJson(req.body.metadata, adBannerMetaSchema)
    : { placement: "home_hero" };
  const uuid = randomUUID().replace(/-/g, "");
  const placement = meta.placement ?? "home_hero";
  const publicId = `ads/${placement}/banner-${uuid}`;
  const result = await uploadImageBuffer({
    buffer: file.buffer,
    publicId,
    publicBaseUrl: requestPublicBase(req),
  });
  sendSuccess(res, {
    url: result.url,
    publicId: result.publicId,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
    variants: result.variants,
  });
}

export async function brandLogo(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file?.buffer) {
    throw new AppError(400, "File is required", "VALIDATION");
  }
  const meta = parseMultipartJson(req.body.metadata, brandLogoMetaSchema);
  await assertBrandKeyInInventory(meta.brandKey);
  const folder = sanitizeBrandFolderSegment(meta.brandKey);
  const uuid = randomUUID().replace(/-/g, "");
  const publicId = `brands/${folder}/logo-${uuid}`;
  const result = await uploadImageBuffer({
    buffer: file.buffer,
    publicId,
    publicBaseUrl: requestPublicBase(req),
  });
  sendSuccess(res, {
    url: result.url,
    publicId: result.publicId,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
    variants: result.variants,
  });
}
