import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

function extFromBuffer(buf: Buffer): string {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) {
    return "jpg";
  }
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e) {
    return "png";
  }
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return "gif";
  }
  if (buf.length >= 12 && buf.toString("ascii", 8, 12) === "WEBP") {
    return "webp";
  }
  return "jpg";
}

/** Strip path traversal; keep folder/file-safe segments only. */
function sanitizeRelativeBase(basePath: string): string {
  return basePath
    .replace(/^\/+/, "")
    .split(/[/\\]+/)
    .filter((s) => s && s !== ".." && s !== ".")
    .join(path.sep);
}

export async function saveLocalImageBuffer(options: {
  buffer: Buffer;
  /** Logical path without extension, e.g. ads/home_hero/banner-abc */
  basePath: string;
}): Promise<{
  webPath: string;
  publicId: string;
  bytes: number;
}> {
  const safe = sanitizeRelativeBase(options.basePath);
  if (!safe) {
    throw new Error("Invalid upload path");
  }
  const ext = extFromBuffer(options.buffer);
  const relativeWithExt = `${safe.replace(/\\/g, "/")}.${ext}`;
  const diskPath = path.join(UPLOAD_ROOT, relativeWithExt);
  await mkdir(path.dirname(diskPath), { recursive: true });
  await writeFile(diskPath, options.buffer);
  return {
    webPath: relativeWithExt,
    publicId: `local/${relativeWithExt}`,
    bytes: options.buffer.length,
  };
}

export function getUploadsRoot(): string {
  return UPLOAD_ROOT;
}
