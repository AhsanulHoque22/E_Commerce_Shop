import type { Request, Response } from "express";
import {
  createVariant,
  deleteVariant,
  listVariantsForProduct,
  updateVariant,
} from "../services/product/productVariant.service.js";
import {
  createProductVariantSchema,
  updateProductVariantSchema,
} from "../schemas/productVariant.schema.js";
import { parseBody } from "../utils/validate.js";
import { sendSuccess } from "../utils/response.js";
import { paramString } from "../utils/routeParams.js";

export async function list(req: Request, res: Response): Promise<void> {
  const data = await listVariantsForProduct(paramString(req.params.productPublicId));
  sendSuccess(res, data);
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = parseBody(createProductVariantSchema, req.body);
  const data = await createVariant(
    paramString(req.params.productPublicId),
    body,
    req.user!.id
  );
  sendSuccess(res, data, 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const body = parseBody(updateProductVariantSchema, req.body);
  const data = await updateVariant(
    paramString(req.params.productPublicId),
    paramString(req.params.variantPublicId),
    body,
    req.user!.id
  );
  sendSuccess(res, data);
}

export async function remove(req: Request, res: Response): Promise<void> {
  await deleteVariant(
    paramString(req.params.productPublicId),
    paramString(req.params.variantPublicId),
    req.user!.id
  );
  sendSuccess(res, { ok: true });
}
