import { Router } from "express";
import * as ctrl from "../controllers/cart.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

const r = Router();

r.use(requireAuth);
r.get("/", asyncHandler(ctrl.get));
r.post("/items", asyncHandler(ctrl.add));
r.patch("/items", asyncHandler(ctrl.updateLine));
r.delete("/items/:productPublicId", asyncHandler(ctrl.removeLine));

export default r;
