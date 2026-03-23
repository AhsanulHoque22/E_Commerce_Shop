import type { Request, Response } from "express";
import { addToCart, getCart, removeCartLine, updateCartLine } from "../services/cart/cart.service.js";
import { cartItemSchema, cartUpdateSchema } from "../schemas/cart.schema.js";
import { parseBody } from "../utils/validate.js";
import { sendSuccess } from "../utils/response.js";
import { paramString } from "../utils/routeParams.js";

export async function get(req: Request, res: Response): Promise<void> {
  const data = await getCart(req.user!.id);
  sendSuccess(res, data);
}

export async function add(req: Request, res: Response): Promise<void> {
  const body = parseBody(cartItemSchema, req.body);
  const data = await addToCart(req.user!.id, body.productPublicId, body.quantity);
  sendSuccess(res, data, 201);
}

export async function updateLine(req: Request, res: Response): Promise<void> {
  const body = parseBody(cartUpdateSchema, req.body);
  const data = await updateCartLine(req.user!.id, body.productPublicId, body.quantity);
  sendSuccess(res, data);
}

export async function removeLine(req: Request, res: Response): Promise<void> {
  const data = await removeCartLine(
    req.user!.id,
    paramString(req.params.productPublicId)
  );
  sendSuccess(res, data);
}
