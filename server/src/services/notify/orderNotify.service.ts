import { OrderStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import { sendEmail } from "./email.service.js";

/** Customer-facing copy for each status an order can land in via ADMIN_STATUS_TRANSITIONS. */
const STATUS_MESSAGE: Partial<Record<OrderStatus, string>> = {
  [OrderStatus.APPROVED]: "has been approved and is awaiting payment",
  [OrderStatus.PAYMENT_PENDING]: "is awaiting confirmation of your payment",
  [OrderStatus.PAID]: "payment has been confirmed",
  [OrderStatus.SHIPPED]: "has been shipped",
  [OrderStatus.OUT_FOR_DELIVERY]: "is out for delivery",
  [OrderStatus.DELIVERED]: "has been delivered",
  [OrderStatus.COMPLETED]: "is now complete — thank you for shopping with us",
  [OrderStatus.CANCELLED]: "has been cancelled",
};

// ponytail: duplicated minimal fetch-based SMS send (mirrors otp.service.ts's
// sendSms) instead of importing it, since otp.service.ts is off-limits to edit
// and it doesn't export the helper. Best-effort only — errors are swallowed by
// the caller's catch-all, this never throws to it directly to keep call sites simple.
async function trySendSms(to: string, body: string): Promise<void> {
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    console.info(`[ORDER SMS] Twilio not configured — to=${to} ${body}`);
    return;
  }
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Failed to send order SMS: ${t.slice(0, 120)}`);
  }
}

/**
 * Fire-and-forget order status notification. Never throws — a notification
 * provider hiccup must never break the money-path status-update transaction
 * that triggered it. Call this AFTER the status-update transaction commits.
 */
export async function notifyOrderStatusChanged(
  orderPublicId: string,
  fromStatus: OrderStatus,
  toStatus: OrderStatus
): Promise<void> {
  try {
    const copy = STATUS_MESSAGE[toStatus];
    if (!copy) {
      return;
    }
    const order = await prisma.order.findUnique({
      where: { publicId: orderPublicId },
      select: { publicId: true, contactEmail: true, contactPhone: true },
    });
    if (!order) {
      return;
    }
    const message = `Your order #${order.publicId} ${copy}.`;

    await sendEmail({
      to: order.contactEmail,
      subject: `Order #${order.publicId} update`,
      text: message,
      html: `<p>${message}</p>`,
    }).catch((err) => console.error("[orderNotify] email failed:", err));

    if (order.contactPhone) {
      await trySendSms(order.contactPhone, message).catch((err) =>
        console.error("[orderNotify] sms failed:", err)
      );
    }
  } catch (err) {
    console.error("[orderNotify] notifyOrderStatusChanged failed:", err);
  }
}
