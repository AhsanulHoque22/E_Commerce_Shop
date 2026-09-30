import { randomBytes } from "crypto";
import bcrypt from "bcrypt";
import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { hashToken } from "../../utils/hashToken.js";
import { sendEmail } from "../notify/email.service.js";

const SALT_ROUNDS = 12;
const RESET_TTL_MS = 60 * 60 * 1000;

function clientBaseUrl(): string {
  const first = env.CLIENT_ORIGIN.split(",")[0]?.trim();
  return first || "http://localhost:5173";
}

export async function requestPasswordReset(emailRaw: string): Promise<void> {
  const email = emailRaw.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return;
  }
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  const raw = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      tokenHash: hashToken(raw),
      userId: user.id,
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    },
  });
  const url = `${clientBaseUrl().replace(/\/$/, "")}/reset-password?token=${raw}`;
  await sendEmail({
    to: user.email,
    subject: "Reset your password",
    text: `We received a request to reset your password. Use the link below within 1 hour to set a new one:\n\n${url}\n\nIf you didn't request this, you can ignore this email.`,
    html: `<p>We received a request to reset your password. Use the link below within 1 hour to set a new one:</p><p><a href="${url}">${url}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
  });
}

export async function resetPasswordWithToken(
  rawToken: string,
  newPassword: string
): Promise<void> {
  const tokenHash = hashToken(rawToken.trim());
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!row || row.expiresAt < new Date()) {
    throw new AppError(400, "Invalid or expired reset link", "RESET_INVALID");
  }
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.delete({ where: { id: row.id } }),
    prisma.refreshToken.deleteMany({ where: { userId: row.userId } }),
  ]);
}
