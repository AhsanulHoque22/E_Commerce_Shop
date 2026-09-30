import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError.js";
import { sendError } from "../utils/response.js";

// Prisma known-request-error codes mapped to the HTTP status a client should see.
// https://www.prisma.io/docs/orm/reference/error-reference
const PRISMA_STATUS_BY_CODE: Record<string, number> = {
  P2002: 409, // unique constraint violation
  P2003: 409, // foreign key constraint violation
  P2025: 404, // record not found
};

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
      PRISMA_STATUS_BY_CODE[err.code] ?? 400,
      "Request could not be completed",
      err.code
    );
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error(err);
    sendError(res, 400, "Invalid request", "PRISMA_VALIDATION");
    return;
  }

  console.error(err);
  sendError(res, 500, "Internal server error", "INTERNAL");
}
