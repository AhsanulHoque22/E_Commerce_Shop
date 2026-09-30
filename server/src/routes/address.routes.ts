import { Router } from "express";
import * as ctrl from "../controllers/address.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

const r = Router();

r.use(requireAuth);
r.get("/", asyncHandler(ctrl.list));
r.post("/", asyncHandler(ctrl.create));
r.patch("/:publicId", asyncHandler(ctrl.update));
r.delete("/:publicId", asyncHandler(ctrl.remove));
r.post("/:publicId/default", asyncHandler(ctrl.setDefault));

export default r;
