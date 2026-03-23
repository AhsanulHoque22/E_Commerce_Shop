import { Router } from "express";
import * as ctrl from "../controllers/order.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

const r = Router();

r.post("/checkout", requireAuth, asyncHandler(ctrl.checkout));
r.get("/mine", requireAuth, asyncHandler(ctrl.myOrders));
r.get(
  "/mine/:publicId/invoice",
  requireAuth,
  asyncHandler(ctrl.downloadInvoice)
);
r.get(
  "/mine/:publicId/receipt",
  requireAuth,
  asyncHandler(ctrl.downloadReceipt)
);
r.get("/mine/:publicId", requireAuth, asyncHandler(ctrl.myOrder));

r.get(
  "/:publicId/invoice",
  requireAuth,
  asyncHandler(ctrl.downloadInvoice)
);
r.get(
  "/:publicId/receipt",
  requireAuth,
  asyncHandler(ctrl.downloadReceipt)
);
r.get("/:publicId", requireAuth, asyncHandler(ctrl.myOrder));

export default r;
