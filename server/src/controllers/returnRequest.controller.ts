import type { Request, Response } from "express";
import {
  createReturnRequest,
  listReturnRequestsAdmin,
  listReturnRequestsForUser,
  updateReturnRequestAdmin,
} from "../services/returns/returnRequest.service.js";
import {
  returnRequestAdminListQuerySchema,
  returnRequestAdminUpdateSchema,
  returnRequestCreateSchema,
} from "../schemas/returnRequest.schema.js";
import { parseBody, parseQuery } from "../utils/validate.js";
import { sendSuccess } from "../utils/response.js";
import { paramString } from "../utils/routeParams.js";

export async function create(req: Request, res: Response): Promise<void> {
  const body = parseBody(returnRequestCreateSchema, req.body);
  const data = await createReturnRequest(req.user!.id, body);
  sendSuccess(res, data, 201);
}

export async function list(req: Request, res: Response): Promise<void> {
  const data = await listReturnRequestsForUser(req.user!.id);
  sendSuccess(res, data);
}

export async function adminList(req: Request, res: Response): Promise<void> {
  const q = parseQuery(returnRequestAdminListQuerySchema, req.query);
  const data = await listReturnRequestsAdmin(q.status);
  sendSuccess(res, data);
}

export async function adminUpdate(req: Request, res: Response): Promise<void> {
  const body = parseBody(returnRequestAdminUpdateSchema, req.body);
  const data = await updateReturnRequestAdmin(paramString(req.params.publicId), body);
  sendSuccess(res, data);
}
