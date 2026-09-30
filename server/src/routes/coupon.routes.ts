import { Router } from "express";
import * as ctrl from "../controllers/coupon.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const r = Router();

r.use(requireAuth);
r.post("/validate", asyncHandler(ctrl.validate));

const admin = Router();
admin.use(requireAuth, requireAdmin);
admin.get("/", asyncHandler(ctrl.adminList));
admin.post("/", asyncHandler(ctrl.adminCreate));
admin.patch("/:publicId", asyncHandler(ctrl.adminUpdate));
admin.delete("/:publicId", asyncHandler(ctrl.adminDelete));
admin.post("/:publicId/toggle-active", asyncHandler(ctrl.adminToggleActive));
admin.get("/:publicId/stats", asyncHandler(ctrl.adminUsageStats));

export { r as couponRoutes, admin as couponAdminRoutes };
