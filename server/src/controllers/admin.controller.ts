import type { Request, Response } from "express";
import {
  adminCreateCategory,
  adminDeleteCategory,
  adminUpdateCategory,
} from "../services/admin/adminCategory.service.js";
import {
  adminGetOrder,
  adminListOrders,
  adminUpdateOrderStatus,
} from "../services/admin/adminOrder.service.js";
import { getAdminOverview } from "../services/admin/adminStats.service.js";
import {
  adjustProductStock,
  createProduct,
  deleteProductSoft,
  getProductAdminByPublicId,
  listProductsAdmin,
  updateProduct,
} from "../services/product/product.service.js";
import {
  adminBrandPutSchema,
  adminCategoryCreateSchema,
  adminCategoryUpdateSchema,
  adminListOrdersQuerySchema,
  adminOrderStatusBodySchema,
  listAdminProductsQuerySchema,
  stockAdjustSchema,
} from "../schemas/admin.schema.js";
import {
  listAdminInventoryBrands,
  upsertShopBrand,
} from "../services/brand/shopBrand.service.js";
import {
  createProductSchema,
  updateProductSchema,
} from "../schemas/product.schema.js";
import { parseBody, parseQuery } from "../utils/validate.js";
import { sendSuccess } from "../utils/response.js";
import { paramString } from "../utils/routeParams.js";

export async function overview(req: Request, res: Response): Promise<void> {
  const data = await getAdminOverview();
  sendSuccess(res, data);
}

export async function adminBrandsList(
  _req: Request,
  res: Response
): Promise<void> {
  const data = await listAdminInventoryBrands();
  sendSuccess(res, data);
}

export async function adminBrandPut(req: Request, res: Response): Promise<void> {
  const body = parseBody(adminBrandPutSchema, req.body);
  const key = paramString(req.params.brandKey);
  const row = await upsertShopBrand(key, {
    displayName: body.displayName,
    isActive: body.isActive,
    logoUrl: body.logoUrl,
    logoPublicId: body.logoPublicId,
    sortOrder: body.sortOrder,
  });
  sendSuccess(res, row);
}

export async function adminListProducts(
  req: Request,
  res: Response
): Promise<void> {
  const q = parseQuery(listAdminProductsQuerySchema, req.query);
  const stockFilter =
    q.stock === "any" ? undefined : (q.stock as "in_stock" | "out");
  const data = await listProductsAdmin({
    page: q.page,
    limit: q.limit,
    search: q.search,
    categoryPublicId: q.category,
    status: q.status,
    stockFilter,
  });
  sendSuccess(res, data);
}

export async function adminGetProduct(
  req: Request,
  res: Response
): Promise<void> {
  const data = await getProductAdminByPublicId(
    paramString(req.params.publicId)
  );
  sendSuccess(res, data);
}

export async function adminCreateProduct(
  req: Request,
  res: Response
): Promise<void> {
  const body = parseBody(createProductSchema, req.body);
  const data = await createProduct(body, req.user!.id);
  sendSuccess(res, data, 201);
}

export async function adminUpdateProduct(
  req: Request,
  res: Response
): Promise<void> {
  const body = parseBody(updateProductSchema, req.body);
  const data = await updateProduct(
    paramString(req.params.publicId),
    body,
    req.user!.id
  );
  sendSuccess(res, data);
}

export async function adminRemoveProduct(
  req: Request,
  res: Response
): Promise<void> {
  await deleteProductSoft(paramString(req.params.publicId), req.user!.id);
  sendSuccess(res, { ok: true });
}

export async function adminStockAdjust(
  req: Request,
  res: Response
): Promise<void> {
  const body = parseBody(stockAdjustSchema, req.body);
  const data = await adjustProductStock(
    paramString(req.params.publicId),
    body.delta,
    req.user!.id
  );
  sendSuccess(res, data);
}

export async function adminOrdersList(
  req: Request,
  res: Response
): Promise<void> {
  const q = parseQuery(adminListOrdersQuerySchema, req.query);
  const data = await adminListOrders({
    page: q.page,
    limit: q.limit,
    status: q.status,
    search: q.search,
  });
  sendSuccess(res, data);
}

export async function adminOrderOne(
  req: Request,
  res: Response
): Promise<void> {
  const data = await adminGetOrder(paramString(req.params.publicId));
  sendSuccess(res, data);
}

export async function adminOrderPutStatus(
  req: Request,
  res: Response
): Promise<void> {
  const body = parseBody(adminOrderStatusBodySchema, req.body);
  const row = await adminUpdateOrderStatus({
    publicId: paramString(req.params.publicId),
    nextStatus: body.status,
    actorUserId: req.user!.id,
    shipmentTrackingId: body.shipmentTrackingId,
    courierName: body.courierName,
    shipmentTrackingUrl: body.shipmentTrackingUrl,
    paymentReference: body.paymentReference,
    paymentStatus: body.paymentStatus,
  });
  sendSuccess(res, row);
}

export async function adminPostCategory(
  req: Request,
  res: Response
): Promise<void> {
  const body = parseBody(adminCategoryCreateSchema, req.body);
  const row = await adminCreateCategory(body, req.user!.id);
  sendSuccess(res, row, 201);
}

export async function adminPatchCategory(
  req: Request,
  res: Response
): Promise<void> {
  const body = parseBody(adminCategoryUpdateSchema, req.body);
  const row = await adminUpdateCategory(
    paramString(req.params.publicId),
    body,
    req.user!.id
  );
  sendSuccess(res, row);
}

export async function adminRemoveCategory(
  req: Request,
  res: Response
): Promise<void> {
  await adminDeleteCategory(paramString(req.params.publicId), req.user!.id);
  sendSuccess(res, { ok: true });
}
