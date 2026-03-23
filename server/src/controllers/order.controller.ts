import type { Request, Response } from "express";
import {
  createOrderFromCart,
  getInvoicePdfForUser,
  getOrderForUser,
  getReceiptPdfForUser,
  listOrdersForUser,
} from "../services/order/order.service.js";
import { checkoutSchema } from "../schemas/order.schema.js";
import { parseBody } from "../utils/validate.js";
import { sendSuccess } from "../utils/response.js";
import { paramString } from "../utils/routeParams.js";

export async function checkout(req: Request, res: Response): Promise<void> {
  const body = parseBody(checkoutSchema, req.body);
  const data = await createOrderFromCart(req.user!.id, body);
  sendSuccess(res, data, 201);
}

export async function myOrders(req: Request, res: Response): Promise<void> {
  const data = await listOrdersForUser(req.user!.id);
  sendSuccess(res, data);
}

export async function myOrder(req: Request, res: Response): Promise<void> {
  const data = await getOrderForUser(
    req.user!.id,
    paramString(req.params.publicId)
  );
  sendSuccess(res, data);
}

export async function downloadInvoice(req: Request, res: Response): Promise<void> {
  const publicId = paramString(req.params.publicId);
  const pdf = await getInvoicePdfForUser(req.user!.id, publicId);
  const safeFile = `invoice-${publicId.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFile}"`);
  res.send(pdf);
}

export async function downloadReceipt(req: Request, res: Response): Promise<void> {
  const publicId = paramString(req.params.publicId);
  const pdf = await getReceiptPdfForUser(req.user!.id, publicId);
  const safeFile = `receipt-${publicId.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFile}"`);
  res.send(pdf);
}
