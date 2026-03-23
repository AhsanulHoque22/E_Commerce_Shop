import { Router } from "express";
import * as ctrl from "../controllers/complaint.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { optionalAuth, requireAuth, requireAdmin } from "../middleware/auth.js";

const r = Router();

r.post("/", optionalAuth, asyncHandler(ctrl.create));

const admin = Router();
admin.use(requireAuth, requireAdmin);
admin.get("/", asyncHandler(ctrl.adminList));

export { r as complaintRoutes, admin as complaintAdminRoutes };
