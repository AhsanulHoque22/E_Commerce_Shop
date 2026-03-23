import type { CookieOptions, Response } from "express";
import { env } from "../config/env.js";

const isProd = env.NODE_ENV === "production";

export function cookieBase(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string
): void {
  const base = cookieBase();
  res.cookie("access_token", accessToken, {
    ...base,
    maxAge: 15 * 60 * 1000,
  });
  res.cookie("refresh_token", refreshToken, {
    ...base,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  const base = cookieBase();
  res.clearCookie("access_token", base);
  res.clearCookie("refresh_token", base);
}
