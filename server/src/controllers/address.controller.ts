import type { Request, Response } from "express";
import {
  createAddress,
  deleteAddress,
  listAddresses,
  setDefaultAddress,
  updateAddress,
} from "../services/address/address.service.js";
import { addressCreateSchema, addressUpdateSchema } from "../schemas/address.schema.js";
import { parseBody } from "../utils/validate.js";
import { sendSuccess } from "../utils/response.js";
import { paramString } from "../utils/routeParams.js";

export async function list(req: Request, res: Response): Promise<void> {
  const data = await listAddresses(req.user!.id);
  sendSuccess(res, data);
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = parseBody(addressCreateSchema, req.body);
  const data = await createAddress(req.user!.id, body);
  sendSuccess(res, data, 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const body = parseBody(addressUpdateSchema, req.body);
  const data = await updateAddress(req.user!.id, paramString(req.params.publicId), body);
  sendSuccess(res, data);
}

export async function remove(req: Request, res: Response): Promise<void> {
  await deleteAddress(req.user!.id, paramString(req.params.publicId));
  sendSuccess(res, { deleted: true });
}

export async function setDefault(req: Request, res: Response): Promise<void> {
  const data = await setDefaultAddress(req.user!.id, paramString(req.params.publicId));
  sendSuccess(res, data);
}
