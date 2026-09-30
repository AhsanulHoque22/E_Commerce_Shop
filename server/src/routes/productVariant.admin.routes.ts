import { Router } from "express";
import * as ctrl from "../controllers/productVariant.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

/**
 * Meant to be mounted at /api/admin/products/:productPublicId/variants
 * (see admin.routes.ts). Not mounted by this file itself — see the final
 * report for the exact mount line, since admin.routes.ts is off-limits here.
 */
const r = Router({ mergeParams: true });

r.use(requireAuth, requireAdmin);
r.get("/", asyncHandler(ctrl.list));
r.post("/", asyncHandler(ctrl.create));
r.put("/:variantPublicId", asyncHandler(ctrl.update));
r.delete("/:variantPublicId", asyncHandler(ctrl.remove));

export default r;
