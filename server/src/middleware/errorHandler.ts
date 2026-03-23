import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError.js";
import { sendError } from "../utils/response.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.message, err.code);
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(err);
    sendError(
      res,
      400,
      `Database error (${err.code}): ${err.message}`,
      err.code
    );
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error(err);
    sendError(res, 400, err.message, "PRISMA_VALIDATION");
    return;
  }

  console.error(err);

  const msg =
    err instanceof Error && err.message.trim()
      ? err.message
      : "Internal server error";
  sendError(res, 500, msg, "INTERNAL");
}
