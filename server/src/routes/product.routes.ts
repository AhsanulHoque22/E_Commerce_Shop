import { Router } from "express";
import * as ctrl from "../controllers/product.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { optionalAuth, requireAuth, requireCustomer } from "../middleware/auth.js";

const r = Router();

r.get("/facets", optionalAuth, asyncHandler(ctrl.facets));
r.get("/brands", optionalAuth, asyncHandler(ctrl.showcaseBrands));
r.get("/", optionalAuth, asyncHandler(ctrl.list));
r.get("/:publicId/reviews", asyncHandler(ctrl.listReviews));
r.post(
  "/:publicId/reviews",
  requireAuth,
  requireCustomer,
  asyncHandler(ctrl.addReview)
);
r.get("/:publicId", optionalAuth, asyncHandler(ctrl.getOne));

export default r;
