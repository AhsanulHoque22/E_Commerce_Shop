import { env } from "../config/env.js";

/** Build optimized delivery URLs from public_id (f_auto, q_auto, width caps). */
export function variantUrls(publicId: string): {
  thumbnail: string;
  medium: string;
  full: string;
} {
  const cloud = env.CLOUDINARY_CLOUD_NAME;
  const base = `https://res.cloudinary.com/${cloud}/image/upload`;
  const common = "f_auto,q_auto";
  return {
    thumbnail: `${base}/c_fill,w_320,${common}/${publicId}`,
    medium: `${base}/c_limit,w_800,${common}/${publicId}`,
    full: `${base}/c_limit,w_1600,${common}/${publicId}`,
  };
}
