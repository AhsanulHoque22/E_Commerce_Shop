import type { Request, Response } from "express";
import { z } from "zod";
import {
  addFavorite,
  listFavorites,
  removeFavorite,
} from "../services/favorite/favorite.service.js";
import { parseBody } from "../utils/validate.js";
import { sendSuccess } from "../utils/response.js";
import { paramString } from "../utils/routeParams.js";

const addSchema = z.object({
  productPublicId: z.string().min(1).max(64),
});

export async function list(req: Request, res: Response): Promise<void> {
  const rows = await listFavorites(req.user!.id);
  sendSuccess(res, { items: rows });
}

export async function add(req: Request, res: Response): Promise<void> {
  const body = parseBody(addSchema, req.body);
  await addFavorite(req.user!.id, body.productPublicId);
  sendSuccess(res, { ok: true }, 201);
}

export async function remove(req: Request, res: Response): Promise<void> {
  await removeFavorite(req.user!.id, paramString(req.params.productPublicId));
  sendSuccess(res, { ok: true });
}
