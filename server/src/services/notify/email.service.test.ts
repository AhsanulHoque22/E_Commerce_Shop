import { test } from "node:test";
import assert from "node:assert/strict";
import { env } from "../../config/env.js";
import { sendEmail } from "./email.service.js";

test("sendEmail: falls back to console.info when SMTP_HOST is unset", async (t) => {
  assert.equal(env.SMTP_HOST, undefined, "test env must not configure SMTP");
  const calls: unknown[][] = [];
  const original = console.info;
  console.info = (...args: unknown[]) => calls.push(args);
  t.after(() => {
    console.info = original;
  });

  await sendEmail({
    to: "user@example.com",
    subject: "Test subject",
    text: "Test body",
  });

  assert.equal(calls.length, 1);
  assert.match(String(calls[0][0]), /\[EMAIL\] to=user@example\.com subject=Test subject/);
});
