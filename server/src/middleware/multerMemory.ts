import multer from "multer";
import { env } from "../config/env.js";

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

export const uploadImageMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (allowed.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
  },
});
