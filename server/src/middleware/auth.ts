import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/db.js";
import { AppError } from "../utils/AppError.js";

export type AuthUser = {
  id: string;
  publicId: string;
  email: string;
  role: "CUSTOMER" | "ADMIN";
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies?.access_token;
    if (!token) {
      next();
      return;
    }
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
      sub: string;
      email: string;
      role: "CUSTOMER" | "ADMIN";
    };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, publicId: true, email: true, role: true },
    });
    if (user) {
      req.user = {
        id: user.id,
        publicId: user.publicId,
        email: user.email,
        role: user.role,
      };
    }
    next();
  } catch {
    next();
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies?.access_token;
    if (!token) {
      throw new AppError(401, "Authentication required", "AUTH_REQUIRED");
    }
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
      sub: string;
      email: string;
      role: "CUSTOMER" | "ADMIN";
    };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, publicId: true, email: true, role: true },
    });
    if (!user) {
      throw new AppError(401, "Invalid session", "AUTH_INVALID");
    }
    req.user = {
      id: user.id,
      publicId: user.publicId,
      email: user.email,
      role: user.role,
    };
    next();
  } catch (e) {
    if (e instanceof AppError) {
      next(e);
      return;
    }
    next(new AppError(401, "Authentication required", "AUTH_REQUIRED"));
  }
}

export function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.role !== "ADMIN") {
    next(new AppError(403, "Admin access required", "FORBIDDEN"));
    return;
  }
  next();
}

export function requireCustomer(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.role !== "CUSTOMER") {
    next(new AppError(403, "Customer access required", "FORBIDDEN"));
    return;
  }
  next();
}
