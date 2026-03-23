import { Router } from "express";
import * as ctrl from "../controllers/category.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
const r = Router();

r.get("/", asyncHandler(ctrl.list));
r.get("/:publicId", asyncHandler(ctrl.getOne));

export default r;
