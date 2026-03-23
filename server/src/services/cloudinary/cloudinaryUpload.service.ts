import { Readable } from "stream";
import { cloudinary } from "../../config/cloudinary.js";
import { cloudinaryConfigured } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { variantUrls } from "../../utils/cloudinaryUrls.js";
import { saveLocalImageBuffer } from "../storage/localImageUpload.service.js";

export type UploadResult = {
  url: string;
  publicId: string;
  width: number;
  height: number;
  bytes: number;
  variants: ReturnType<typeof variantUrls>;
};

export async function uploadImageBuffer(options: {
  buffer: Buffer;
  /** Full Cloudinary public_id including folder path, e.g. products/prod_x/main-uuid */
  publicId: string;
  /** Used for local disk mode, e.g. http://localhost:5000 */
  publicBaseUrl: string;
}): Promise<UploadResult> {
  const { buffer, publicId, publicBaseUrl } = options;

  if (!cloudinaryConfigured()) {
    const local = await saveLocalImageBuffer({
      buffer,
      basePath: publicId,
    });
    const url = `${publicBaseUrl.replace(/\/$/, "")}/uploads/${local.webPath}`;
    const same = { thumbnail: url, medium: url, full: url };
    return {
      url,
      publicId: local.publicId,
      width: 0,
      height: 0,
      bytes: local.bytes,
      variants: same,
    };
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: "image",
        overwrite: false,
        invalidate: true,
        quality: "auto",
        fetch_format: "auto",
      },
      (err, result) => {
        if (err || !result) {
          reject(
            new AppError(502, "Failed to upload image", "CLOUDINARY_ERROR")
          );
          return;
        }
        const pid = result.public_id;
        resolve({
          url: result.secure_url,
          publicId: pid,
          width: result.width ?? 0,
          height: result.height ?? 0,
          bytes: result.bytes ?? 0,
          variants: variantUrls(pid),
        });
      }
    );
    Readable.from(buffer).pipe(stream);
  });
}
