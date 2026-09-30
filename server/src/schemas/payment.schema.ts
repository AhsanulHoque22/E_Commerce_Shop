import { z } from "zod";

/** No client-supplied fields needed — amount/currency/customer info all come
 * from the order itself, never trust the client for money. Kept as a schema
 * (rather than skipped) only to match the parseBody(schema, req.body) pattern. */
export const initiatePaymentSchema = z.object({}).passthrough();

/**
 * Fields SSLCommerz POSTs (application/x-www-form-urlencoded) to ipn_url,
 * success_url, fail_url and cancel_url. We only need tran_id (our
 * order.publicId) + val_id to look the transaction up and re-verify it
 * server-to-server; passthrough() lets the many other fields SSLCommerz
 * sends (card_type, bank_tran_id, risk_level, verify_sign, ...) through
 * without us having to model them.
 */
export const gatewayCallbackSchema = z
  .object({
    tran_id: z.string().min(1),
    val_id: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();
