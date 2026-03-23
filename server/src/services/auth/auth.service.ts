import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { hashToken } from "../../utils/hashToken.js";
import { newPublicId } from "../../utils/ids.js";
import { isEmailIdentifier, normalizePhone } from "../../utils/phone.js";
import { verifyAndConsumeRegisterOtp } from "./otp.service.js";

const SALT_ROUNDS = 12;
const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_SEC = 7 * 24 * 60 * 60;

export type AddressPayload = {
  formatted: string;
  lat: number;
  lng: number;
};

export type UserTokenSlice = {
  id: string;
  publicId: string;
  email: string;
  role: "CUSTOMER" | "ADMIN";
};

export async function issueTokensForUser(
  user: UserTokenSlice,
  ip?: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TTL_SEC }
  );
  const refreshToken = jwt.sign(
    { sub: user.id, typ: "refresh" },
    env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TTL_SEC }
  );

  const expiresAt = new Date(Date.now() + REFRESH_TTL_SEC * 1000);
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      expiresAt,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "auth.login",
      entityType: "user",
      entityId: user.publicId,
      userId: user.id,
      ip,
    },
  });

  return { accessToken, refreshToken };
}

async function findUserByLoginIdentifier(identifier: string) {
  const t = identifier.trim();
  if (!t) {
    return null;
  }
  if (isEmailIdentifier(t)) {
    return prisma.user.findUnique({ where: { email: t.toLowerCase() } });
  }
  const phone = normalizePhone(t);
  if (!phone) {
    return null;
  }
  return prisma.user.findUnique({ where: { phone } });
}

export async function registerUser(input: {
  email: string;
  password: string;
  phone: string;
  otpCode: string;
  firstName?: string;
  lastName?: string;
  consent: boolean;
  sameAsPermanentForPresent: boolean;
  samePresentForDelivery: boolean;
  permanentAddress: AddressPayload;
  presentAddress?: AddressPayload;
  deliveryAddress?: AddressPayload;
}): Promise<UserTokenSlice> {
  if (!input.consent) {
    throw new AppError(400, "Consent is required", "CONSENT_REQUIRED");
  }
  const phoneNorm = normalizePhone(input.phone);
  if (phoneNorm.length < 11) {
    throw new AppError(400, "Enter a valid phone number", "PHONE_INVALID");
  }
  const otpOk = await verifyAndConsumeRegisterOtp(input.phone, input.otpCode);
  if (!otpOk) {
    throw new AppError(400, "Invalid or expired verification code", "OTP_INVALID");
  }

  const present = input.sameAsPermanentForPresent
    ? input.permanentAddress
    : input.presentAddress;
  if (!present) {
    throw new AppError(400, "Present address is required", "ADDRESS_REQUIRED");
  }
  const delivery = input.samePresentForDelivery ? present : input.deliveryAddress;
  if (!delivery) {
    throw new AppError(400, "Delivery address is required", "ADDRESS_REQUIRED");
  }

  const email = input.email.toLowerCase();
  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    throw new AppError(409, "Email already registered", "EMAIL_TAKEN");
  }
  const existingPhone = await prisma.user.findUnique({
    where: { phone: phoneNorm },
  });
  if (existingPhone) {
    throw new AppError(409, "Phone number already registered", "PHONE_TAKEN");
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const permJson = input.permanentAddress as unknown as Prisma.InputJsonValue;
  const presJson = present as unknown as Prisma.InputJsonValue;
  const delJson = delivery as unknown as Prisma.InputJsonValue;

  const user = await prisma.user.create({
    data: {
      publicId: newPublicId("usr"),
      email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: phoneNorm,
      phoneVerifiedAt: new Date(),
      permanentAddress: permJson,
      presentAddress: presJson,
      deliveryAddress: delJson,
      consentAt: new Date(),
      role: "CUSTOMER",
    },
    select: { id: true, publicId: true, email: true, role: true },
  });

  await prisma.auditLog.create({
    data: {
      action: "user.register",
      entityType: "user",
      entityId: user.publicId,
      metadata: { email: user.email, phone: phoneNorm },
    },
  });

  return user;
}

export async function loginUser(
  identifier: string,
  password: string,
  ip?: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const user = await findUserByLoginIdentifier(identifier);
  if (!user) {
    await prisma.auditLog.create({
      data: {
        action: "auth.login_failed",
        entityType: "user",
        ip,
        metadata: { identifier: identifier.trim() },
      },
    });
    throw new AppError(401, "Invalid email, phone, or password", "AUTH_FAILED");
  }
  if (!user.passwordHash?.trim()) {
    await prisma.auditLog.create({
      data: {
        action: "auth.login_failed",
        entityType: "user",
        entityId: user.publicId,
        ip,
        metadata: { reason: "no_password_hash" },
      },
    });
    throw new AppError(
      401,
      "This account uses Google or Facebook sign-in. Use that button to log in.",
      "OAUTH_ONLY"
    );
  }

  let ok = false;
  try {
    ok = await bcrypt.compare(password, user.passwordHash);
  } catch {
    throw new AppError(401, "Invalid email, phone, or password", "AUTH_FAILED");
  }
  if (!ok) {
    await prisma.auditLog.create({
      data: {
        action: "auth.login_failed",
        entityType: "user",
        entityId: user.publicId,
        ip,
        metadata: { email: user.email },
      },
    });
    throw new AppError(401, "Invalid email, phone, or password", "AUTH_FAILED");
  }

  return issueTokensForUser(
    {
      id: user.id,
      publicId: user.publicId,
      email: user.email,
      role: user.role,
    },
    ip
  );
}

export async function refreshSession(
  refreshToken: string,
  ip?: string
): Promise<{ accessToken: string; refreshToken: string }> {
  let payload: { sub: string; typ?: string };
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as {
      sub: string;
      typ?: string;
    };
  } catch {
    throw new AppError(401, "Invalid refresh token", "AUTH_INVALID");
  }
  if (payload.typ !== "refresh") {
    throw new AppError(401, "Invalid refresh token", "AUTH_INVALID");
  }

  const hash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hash },
    include: { user: true },
  });
  if (!stored || stored.expiresAt < new Date()) {
    throw new AppError(401, "Session expired", "AUTH_EXPIRED");
  }

  const user = stored.user;
  await prisma.refreshToken.delete({ where: { id: stored.id } });

  const accessToken = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TTL_SEC }
  );
  const newRefresh = jwt.sign(
    { sub: user.id, typ: "refresh" },
    env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TTL_SEC }
  );
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(newRefresh),
      userId: user.id,
      expiresAt: new Date(Date.now() + REFRESH_TTL_SEC * 1000),
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "auth.refresh",
      entityType: "user",
      entityId: user.publicId,
      userId: user.id,
      ip,
    },
  });

  return { accessToken, refreshToken: newRefresh };
}

export async function logoutUser(
  refreshToken: string | undefined,
  userId?: string
): Promise<void> {
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({
      where: { tokenHash: hashToken(refreshToken) },
    });
  } else if (userId) {
    await prisma.refreshToken.deleteMany({ where: { userId } });
  }
  if (userId) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { publicId: true },
    });
    if (u) {
      await prisma.auditLog.create({
        data: {
          action: "auth.logout",
          entityType: "user",
          entityId: u.publicId,
          userId,
        },
      });
    }
  }
}
