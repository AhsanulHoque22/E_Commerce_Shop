import { Router } from "express";
import * as ctrl from "../controllers/returnRequest.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const r = Router();

r.use(requireAuth);
r.post("/", asyncHandler(ctrl.create));
r.get("/", asyncHandler(ctrl.list));

const admin = Router();
admin.use(requireAuth, requireAdmin);
admin.get("/", asyncHandler(ctrl.adminList));
admin.patch("/:publicId", asyncHandler(ctrl.adminUpdate));

export { r as returnRequestRoutes, admin as returnRequestAdminRoutes };
