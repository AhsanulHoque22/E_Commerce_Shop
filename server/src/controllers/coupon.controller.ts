import type { Request, Response } from "express";
import {
  createCouponAdmin,
  deleteCouponAdmin,
  getCouponUsageStatsAdmin,
  listCouponsAdmin,
  toggleCouponActiveAdmin,
  updateCouponAdmin,
  validateCoupon,
} from "../services/coupon/coupon.service.js";
import { couponCreateSchema, couponUpdateSchema, couponValidateSchema } from "../schemas/coupon.schema.js";
import { parseBody } from "../utils/validate.js";
import { sendSuccess } from "../utils/response.js";
import { paramString } from "../utils/routeParams.js";

export async function validate(req: Request, res: Response): Promise<void> {
  const body = parseBody(couponValidateSchema, req.body);
  const data = await validateCoupon(body.code, req.user!.id, body.subtotal);
  sendSuccess(res, data);
}

export async function adminList(req: Request, res: Response): Promise<void> {
  const data = await listCouponsAdmin();
  sendSuccess(res, data);
}

export async function adminCreate(req: Request, res: Response): Promise<void> {
  const body = parseBody(couponCreateSchema, req.body);
  const data = await createCouponAdmin(body);
  sendSuccess(res, data, 201);
}

export async function adminUpdate(req: Request, res: Response): Promise<void> {
  const body = parseBody(couponUpdateSchema, req.body);
  const data = await updateCouponAdmin(paramString(req.params.publicId), body);
  sendSuccess(res, data);
}

export async function adminDelete(req: Request, res: Response): Promise<void> {
  await deleteCouponAdmin(paramString(req.params.publicId));
  sendSuccess(res, { deleted: true });
}

export async function adminToggleActive(req: Request, res: Response): Promise<void> {
  const data = await toggleCouponActiveAdmin(paramString(req.params.publicId));
  sendSuccess(res, data);
}

export async function adminUsageStats(req: Request, res: Response): Promise<void> {
  const data = await getCouponUsageStatsAdmin(paramString(req.params.publicId));
  sendSuccess(res, data);
}
