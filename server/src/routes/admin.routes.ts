import { Router } from "express";
import * as ctrl from "../controllers/admin.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const r = Router();

r.use(requireAuth, requireAdmin);

r.get("/overview", asyncHandler(ctrl.overview));

r.get("/brands", asyncHandler(ctrl.adminBrandsList));
r.put("/brands/:brandKey", asyncHandler(ctrl.adminBrandPut));

r.get("/products", asyncHandler(ctrl.adminListProducts));
r.post("/products", asyncHandler(ctrl.adminCreateProduct));
r.get("/products/:publicId", asyncHandler(ctrl.adminGetProduct));
r.put("/products/:publicId", asyncHandler(ctrl.adminUpdateProduct));
r.delete("/products/:publicId", asyncHandler(ctrl.adminRemoveProduct));
r.post("/products/:publicId/stock", asyncHandler(ctrl.adminStockAdjust));

r.get("/orders", asyncHandler(ctrl.adminOrdersList));
r.get("/orders/:publicId", asyncHandler(ctrl.adminOrderOne));
r.put("/orders/:publicId/status", asyncHandler(ctrl.adminOrderPutStatus));

r.post("/categories", asyncHandler(ctrl.adminPostCategory));
r.patch("/categories/:publicId", asyncHandler(ctrl.adminPatchCategory));
r.delete("/categories/:publicId", asyncHandler(ctrl.adminRemoveCategory));

export default r;
