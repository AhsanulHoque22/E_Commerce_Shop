import express, { Router } from "express";
import * as ctrl from "../controllers/payment.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

const r = Router();

// SSLCommerz posts application/x-www-form-urlencoded bodies to the
// ipn/success/fail/cancel endpoints below. app.ts only registers
// express.json(), so we scope the form parser to this router instead of
// touching app.ts. JSON requests to /initiate (our own frontend) are
// unaffected — express.json() at the app level already parsed those.
r.use(express.urlencoded({ extended: false }));

r.post("/initiate/:orderPublicId", requireAuth, asyncHandler(ctrl.initiate));
r.post("/ipn", asyncHandler(ctrl.ipn));
r.post("/success", asyncHandler(ctrl.success));
r.post("/fail", asyncHandler(ctrl.fail));
r.post("/cancel", asyncHandler(ctrl.cancel));

export default r;
