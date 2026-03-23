import type { Request, Response } from "express";
import {
  issueTokensForUser,
  loginUser,
  logoutUser,
  refreshSession,
  registerUser,
} from "../services/auth/auth.service.js";
import { requestRegisterOtp } from "../services/auth/otp.service.js";
import {
  requestPasswordReset,
  resetPasswordWithToken,
} from "../services/auth/passwordReset.service.js";
import {
  upsertFacebookUser,
  upsertGoogleUser,
  verifyFacebookAccessToken,
  verifyGoogleIdToken,
} from "../services/auth/oauth.service.js";
import {
  facebookAuthSchema,
  forgotPasswordSchema,
  googleAuthSchema,
  loginSchema,
  otpRequestSchema,
  registerSchema,
  resetPasswordSchema,
} from "../schemas/auth.schema.js";
import { parseBody } from "../utils/validate.js";
import { sendSuccess } from "../utils/response.js";
import { clearAuthCookies, setAuthCookies } from "../utils/cookies.js";
import { prisma } from "../config/db.js";

export async function requestOtp(req: Request, res: Response): Promise<void> {
  const body = parseBody(otpRequestSchema, req.body);
  const extra = await requestRegisterOtp(body.phone);
  sendSuccess(res, { sent: true, ...extra });
}

export async function register(req: Request, res: Response): Promise<void> {
  const body = parseBody(registerSchema, req.body);
  const user = await registerUser(body);
  const tokens = await issueTokensForUser(user, req.ip);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  sendSuccess(
    res,
    { user: { publicId: user.publicId, email: user.email } },
    201
  );
}

export async function login(req: Request, res: Response): Promise<void> {
  const body = parseBody(loginSchema, req.body);
  const tokens = await loginUser(body.identifier, body.password, req.ip);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  sendSuccess(res, { ok: true });
}

export async function authGoogle(req: Request, res: Response): Promise<void> {
  const body = parseBody(googleAuthSchema, req.body);
  const profile = await verifyGoogleIdToken(body.idToken);
  const user = await upsertGoogleUser(profile);
  const tokens = await issueTokensForUser(user, req.ip);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  sendSuccess(res, {
    user: { publicId: user.publicId, email: user.email },
  });
}

export async function authFacebook(req: Request, res: Response): Promise<void> {
  const body = parseBody(facebookAuthSchema, req.body);
  const profile = await verifyFacebookAccessToken(body.accessToken);
  const user = await upsertFacebookUser(profile);
  const tokens = await issueTokensForUser(user, req.ip);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  sendSuccess(res, {
    user: { publicId: user.publicId, email: user.email },
  });
}

export async function forgotPassword(
  req: Request,
  res: Response
): Promise<void> {
  const body = parseBody(forgotPasswordSchema, req.body);
  await requestPasswordReset(body.email);
  sendSuccess(res, {
    ok: true,
    message:
      "If an account exists for that email, a reset link has been generated. Check the server log in development.",
  });
}

export async function resetPassword(
  req: Request,
  res: Response
): Promise<void> {
  const body = parseBody(resetPasswordSchema, req.body);
  await resetPasswordWithToken(body.token, body.password);
  sendSuccess(res, { ok: true });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const rt = req.cookies?.refresh_token;
  if (!rt) {
    clearAuthCookies(res);
    res.status(401).json({ success: false, message: "No refresh token" });
    return;
  }
  const tokens = await refreshSession(rt, req.ip);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  sendSuccess(res, { ok: true });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const rt = req.cookies?.refresh_token;
  await logoutUser(rt, req.user?.id);
  clearAuthCookies(res);
  sendSuccess(res, { ok: true });
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    sendSuccess(res, { user: null });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      publicId: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      phone: true,
      phoneVerifiedAt: true,
      permanentAddress: true,
      presentAddress: true,
      deliveryAddress: true,
      createdAt: true,
    },
  });
  sendSuccess(res, { user });
}
