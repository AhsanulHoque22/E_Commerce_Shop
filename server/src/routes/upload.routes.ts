import { Router } from "express";
import * as ctrl from "../controllers/upload.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { uploadRateLimiter } from "../middleware/uploadRateLimit.js";
import { uploadImageMemory } from "../middleware/multerMemory.js";

const r = Router();

r.use(requireAuth, requireAdmin, uploadRateLimiter);
r.post(
  "/product-image",
  uploadImageMemory.single("file"),
  asyncHandler(ctrl.productImage)
);
r.post(
  "/ad-banner",
  uploadImageMemory.single("file"),
  asyncHandler(ctrl.adBanner)
);
r.post(
  "/brand-logo",
  uploadImageMemory.single("file"),
  asyncHandler(ctrl.brandLogo)
);

export default r;
