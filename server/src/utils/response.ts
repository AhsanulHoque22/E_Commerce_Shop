import type { Response } from "express";

export function sendSuccess<T>(
  res: Response,
  data: T,
  status = 200,
  message?: string
): void {
  res.status(status).json({
    success: true,
    data,
    ...(message ? { message } : {}),
  });
}

export function sendError(
  res: Response,
  status: number,
  message: string,
  code?: string
): void {
  res.status(status).json({
    success: false,
    message,
    ...(code ? { data: { code } } : {}),
  });
}
