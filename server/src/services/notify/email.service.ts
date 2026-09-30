import nodemailer from "nodemailer";
import { env } from "../../config/env.js";

let transporter: import("nodemailer").Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
    });
  }
  return transporter;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}): Promise<void> {
  const { to, subject, html, text } = params;
  if (!env.SMTP_HOST) {
    console.info(`[EMAIL] to=${to} subject=${subject}\n${text ?? html}`);
    return;
  }
  await getTransporter().sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to,
    subject,
    html,
    text,
  });
}
