import { Router } from "express";
import * as ctrl from "../controllers/advertisement.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const r = Router();

r.get("/", asyncHandler(ctrl.publicList));

const admin = Router();
admin.use(requireAuth, requireAdmin);
admin.get("/", asyncHandler(ctrl.adminList));
admin.post("/", asyncHandler(ctrl.adminCreate));
admin.patch("/:publicId", asyncHandler(ctrl.adminUpdate));

export { r as adRoutes, admin as adAdminRoutes };
