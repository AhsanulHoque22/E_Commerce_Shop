import { Router } from "express";

import * as ctrl from "../controllers/auth.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { optionalAuth } from "../middleware/auth.js";

const r = Router();

r.post("/otp/request", asyncHandler(ctrl.requestOtp));
r.post("/register", asyncHandler(ctrl.register));
r.post("/login", asyncHandler(ctrl.login));
r.post("/google", asyncHandler(ctrl.authGoogle));
r.post("/facebook", asyncHandler(ctrl.authFacebook));
r.post("/forgot-password", asyncHandler(ctrl.forgotPassword));
r.post("/reset-password", asyncHandler(ctrl.resetPassword));
r.post("/refresh", asyncHandler(ctrl.refresh));
r.post("/logout", optionalAuth, asyncHandler(ctrl.logout));
r.get("/me", optionalAuth, asyncHandler(ctrl.me));

export default r;
