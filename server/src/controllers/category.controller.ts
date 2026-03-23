import type { Request, Response } from "express";
import {
  getCategoryByPublicId,
  listCategories,
} from "../services/category/category.service.js";
import { sendSuccess } from "../utils/response.js";
import { paramString } from "../utils/routeParams.js";

export async function list(req: Request, res: Response): Promise<void> {
  const data = await listCategories();
  sendSuccess(res, data);
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const data = await getCategoryByPublicId(paramString(req.params.publicId));
  sendSuccess(res, data);
}
