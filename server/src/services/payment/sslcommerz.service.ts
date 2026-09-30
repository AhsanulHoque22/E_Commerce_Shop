import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";

const SANDBOX_BASE = "https://sandbox.sslcommerz.com";
const LIVE_BASE = "https://securepay.sslcommerz.com";

function gatewayBase(): string {
  return env.SSLCOMMERZ_SANDBOX ? SANDBOX_BASE : LIVE_BASE;
}

export function sslcommerzConfigured(): boolean {
  return Boolean(env.SSLCOMMERZ_STORE_ID && env.SSLCOMMERZ_STORE_PASSWORD);
}

function requireCredentials(): { storeId: string; storePasswd: string } {
  if (!env.SSLCOMMERZ_STORE_ID || !env.SSLCOMMERZ_STORE_PASSWORD) {
    throw new AppError(
      503,
      "Online payment is not configured on this server",
      "PAYMENT_NOT_CONFIGURED"
    );
  }
  return { storeId: env.SSLCOMMERZ_STORE_ID, storePasswd: env.SSLCOMMERZ_STORE_PASSWORD };
}

export type CreateSessionInput = {
  tranId: string;
  amount: number;
  currency: string;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  ipnUrl: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  customerCity: string;
};

/**
 * Creates a payment session via SSLCommerz's Session/Init API
 * (POST {base}/gwprocess/v4/api.php) and returns the gateway redirect URL
 * (GatewayPageURL) the customer's browser should be sent to.
 * Docs: https://developer.sslcommerz.com/doc/v4/#initiate-the-payment
 */
export async function createPaymentSession(input: CreateSessionInput): Promise<string> {
  const { storeId, storePasswd } = requireCredentials();

  const body = new URLSearchParams({
    store_id: storeId,
    store_passwd: storePasswd,
    total_amount: input.amount.toFixed(2),
    currency: input.currency,
    tran_id: input.tranId,
    success_url: input.successUrl,
    fail_url: input.failUrl,
    cancel_url: input.cancelUrl,
    ipn_url: input.ipnUrl,
    shipping_method: "NO",
    product_name: `Order ${input.tranId}`,
    product_category: "General",
    product_profile: "general",
    num_of_item: "1",
    cus_name: input.customerName,
    cus_email: input.customerEmail,
    cus_phone: input.customerPhone || "N/A",
    cus_add1: input.customerAddress || "N/A",
    cus_city: input.customerCity || "Dhaka",
    cus_country: "Bangladesh",
  });

  let res: Response;
  try {
    res = await fetch(`${gatewayBase()}/gwprocess/v4/api.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch {
    throw new AppError(502, "Payment gateway unavailable", "GATEWAY_ERROR");
  }

  if (!res.ok) {
    throw new AppError(502, "Payment gateway unavailable", "GATEWAY_ERROR");
  }

  const data = (await res.json()) as {
    status?: string;
    GatewayPageURL?: string;
    failedreason?: string;
  };
  if (data.status !== "SUCCESS" || !data.GatewayPageURL) {
    throw new AppError(
      502,
      data.failedreason || "Failed to initiate payment session",
      "GATEWAY_ERROR"
    );
  }
  return data.GatewayPageURL;
}

export type ValidatedPayment = {
  status: string;
  tranId: string;
  amount: number;
  currency: string;
  valId: string;
};

/**
 * Re-verifies a val_id server-to-server via SSLCommerz's Order Validation
 * API (GET {base}/validator/api/validationserverAPI.php). SSLCommerz does
 * also send a `verify_sign` HMAC field on the IPN/redirect payload itself,
 * but their own documented anti-fraud pattern is to treat that payload as
 * untrusted and always re-confirm the transaction with this call before
 * marking anything paid — so we never branch on the raw callback body's own
 * status/amount fields, only on what this call returns.
 * Docs: https://developer.sslcommerz.com/doc/v4/#order-validation-api
 */
export async function verifyPaymentByValId(valId: string): Promise<ValidatedPayment> {
  const { storeId, storePasswd } = requireCredentials();
  const qs = new URLSearchParams({
    val_id: valId,
    store_id: storeId,
    store_passwd: storePasswd,
    format: "json",
  });

  let res: Response;
  try {
    res = await fetch(`${gatewayBase()}/validator/api/validationserverAPI.php?${qs.toString()}`);
  } catch {
    throw new AppError(502, "Payment validation gateway unavailable", "GATEWAY_ERROR");
  }

  if (!res.ok) {
    throw new AppError(502, "Payment validation gateway unavailable", "GATEWAY_ERROR");
  }

  const data = (await res.json()) as {
    status?: string;
    tran_id?: string;
    amount?: string;
    currency?: string;
    val_id?: string;
  };

  if (data.status !== "VALID" && data.status !== "VALIDATED") {
    throw new AppError(402, "Payment could not be verified", "PAYMENT_INVALID");
  }

  return {
    status: data.status,
    tranId: data.tran_id ?? "",
    amount: Number(data.amount ?? 0),
    currency: data.currency ?? "",
    valId: data.val_id ?? valId,
  };
}
