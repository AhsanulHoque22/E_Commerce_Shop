import express from "express";
import path from "node:path";
import { mkdirSync } from "node:fs";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import pino from "pino";
import { env } from "./config/env.js";
import { initCloudinary } from "./config/cloudinary.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import orderRoutes from "./routes/order.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import { complaintRoutes, complaintAdminRoutes } from "./routes/complaint.routes.js";
import { adRoutes, adAdminRoutes } from "./routes/advertisement.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import favoriteRoutes from "./routes/favorite.routes.js";
import { AppError } from "./utils/AppError.js";

initCloudinary();

const uploadsDir = path.join(process.cwd(), "uploads");
try {
  mkdirSync(uploadsDir, { recursive: true });
} catch {
  /* ignore */
}

const logger = pino({
  level: env.NODE_ENV === "development" ? "debug" : "info",
});

const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
const clientOrigins = env.CLIENT_ORIGIN.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || clientOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use(
  "/uploads",
  express.static(uploadsDir, {
    maxAge: env.NODE_ENV === "production" ? "7d" : 0,
    fallthrough: true,
  })
);

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      ms: Date.now() - start,
    });
  });
  next();
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", apiLimiter);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/admin/complaints", complaintAdminRoutes);
app.use("/api/ads", adRoutes);
app.use("/api/admin/ads", adAdminRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, _res, next) => {
  next(new AppError(404, `Not found: ${req.path}`, "NOT_FOUND"));
});

app.use(
  (
    err: unknown,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (err instanceof Error && err.message.includes("Only JPEG")) {
      next(new AppError(400, err.message, "VALIDATION"));
      return;
    }
    next(err);
  }
);

app.use(errorHandler);

const port = env.PORT;
app.listen(port, () => {
  logger.info({ port }, "API listening");
});
