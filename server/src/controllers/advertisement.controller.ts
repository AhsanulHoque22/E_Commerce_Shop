import type { Request, Response } from "express";
import { z } from "zod";
import {
  createAd,
  listActiveAds,
  listAdsAdmin,
  updateAd,
} from "../services/advertisement/advertisement.service.js";
import { parseBody } from "../utils/validate.js";
import { sendSuccess } from "../utils/response.js";
import { paramString } from "../utils/routeParams.js";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  imageUrl: z.string().url(),
  imagePublicId: z.string().max(512).optional(),
  linkUrl: z.string().url().optional(),
  linkProductPublicId: z.string().min(1).max(64).optional(),
  linkCategoryPublicId: z.string().min(1).max(64).optional(),
  placement: z.string().max(64).optional(),
  sortOrder: z.number().int().optional(),
});

const updateSchema = createSchema.partial().extend({
  isActive: z.boolean().optional(),
  linkProductPublicId: z.string().min(1).max(64).nullable().optional(),
  linkCategoryPublicId: z.string().min(1).max(64).nullable().optional(),
});

export async function publicList(req: Request, res: Response): Promise<void> {
  const q = req.query.placement;
  const placement =
    typeof q === "string" ? q : Array.isArray(q) && q[0] ? String(q[0]) : undefined;
  const rows = await listActiveAds(placement);
  sendSuccess(res, rows);
}

export async function adminList(req: Request, res: Response): Promise<void> {
  const rows = await listAdsAdmin();
  sendSuccess(res, rows);
}

export async function adminCreate(req: Request, res: Response): Promise<void> {
  const body = parseBody(createSchema, req.body);
  const row = await createAd(body);
  sendSuccess(res, row, 201);
}

export async function adminUpdate(req: Request, res: Response): Promise<void> {
  const body = parseBody(updateSchema, req.body);
  const row = await updateAd(paramString(req.params.publicId), body);
  sendSuccess(res, row);
}
