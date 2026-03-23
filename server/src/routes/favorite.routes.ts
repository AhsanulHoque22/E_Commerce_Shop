import { Router } from "express";
import * as ctrl from "../controllers/favorite.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireCustomer } from "../middleware/auth.js";

const r = Router();

r.use(requireAuth, requireCustomer);
r.get("/", asyncHandler(ctrl.list));
r.post("/", asyncHandler(ctrl.add));
r.delete("/:productPublicId", asyncHandler(ctrl.remove));

export default r;
