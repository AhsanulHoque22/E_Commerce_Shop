import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { normalizePhone } from "../../utils/phone.js";

const OTP_TTL_MS = 10 * 60 * 1000;

function otpHmacSecret(): string {
  return env.OTP_HMAC_SECRET || env.JWT_ACCESS_SECRET;
}

function hashOtpCode(code: string): string {
  return createHmac("sha256", otpHmacSecret()).update(code).digest("hex");
}

function verifyOtpCodeAgainstHash(code: string, storedHash: string): boolean {
  const a = Buffer.from(hashOtpCode(code), "utf8");
  const b = Buffer.from(storedHash, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

function generateSixDigitCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

async function sendSms(to: string, body: string): Promise<void> {
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_FROM_NUMBER;
  if (sid && token && from) {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: to,
          From: from,
          Body: body,
        }),
      }
    );
    if (!res.ok) {
      const t = await res.text();
      throw new AppError(
        502,
        `Failed to send SMS: ${t.slice(0, 120)}`,
        "SMS_FAILED"
      );
    }
    return;
  }
  console.info(`[OTP SMS] Twilio not configured — to=${to} ${body}`);
}

function twilioConfigured(): boolean {
  return Boolean(
    env.TWILIO_ACCOUNT_SID &&
      env.TWILIO_AUTH_TOKEN &&
      env.TWILIO_FROM_NUMBER
  );
}

export async function requestRegisterOtp(
  phoneRaw: string
): Promise<{ devCode?: string }> {
  const phoneNorm = normalizePhone(phoneRaw);
  const digitCount = phoneNorm.replace(/\D/g, "").length;
  if (digitCount < 10 || digitCount > 15) {
    throw new AppError(400, "Enter a valid phone number", "PHONE_INVALID");
  }
  const existing = await prisma.user.findUnique({
    where: { phone: phoneNorm },
  });
  if (existing) {
    throw new AppError(
      409,
      "This phone number is already registered",
      "PHONE_TAKEN"
    );
  }

  await prisma.phoneOtp.deleteMany({
    where: { phoneNorm, purpose: "register" },
  });

  const code = generateSixDigitCode();
  const codeHash = hashOtpCode(code);
  await prisma.phoneOtp.create({
    data: {
      phoneNorm,
      codeHash,
      purpose: "register",
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  await sendSms(
    phoneNorm,
    `Your Aurora Gadgets verification code is: ${code}`
  );

  if (!twilioConfigured()) {
    return { devCode: code };
  }
  if (env.OTP_RETURN_IN_RESPONSE || env.NODE_ENV === "development") {
    return { devCode: code };
  }
  return {};
}

export async function verifyAndConsumeRegisterOtp(
  phoneRaw: string,
  code: string
): Promise<boolean> {
  const phoneNorm = normalizePhone(phoneRaw);
  const row = await prisma.phoneOtp.findFirst({
    where: {
      phoneNorm,
      purpose: "register",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!row) {
    return false;
  }
  if (!verifyOtpCodeAgainstHash(code.trim(), row.codeHash)) {
    return false;
  }
  await prisma.phoneOtp.delete({ where: { id: row.id } });
  return true;
}
