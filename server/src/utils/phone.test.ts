import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, isEmailIdentifier } from "./phone.js";

test("normalizePhone: BD 11-digit 01... -> +880...", () => {
  assert.equal(normalizePhone("01712345678"), "+8801712345678");
});

test("normalizePhone: BD 10-digit 1... -> +880...", () => {
  assert.equal(normalizePhone("1712345678"), "+8801712345678");
});

test("normalizePhone: already has +, strips formatting", () => {
  assert.equal(normalizePhone("+880 171-234-5678"), "+8801712345678");
});

test("normalizePhone: generic international digits get a + prefix", () => {
  assert.equal(normalizePhone("14155552671"), "+14155552671");
});

test("normalizePhone: empty input returns empty string", () => {
  assert.equal(normalizePhone("   "), "");
});

test("isEmailIdentifier: detects @ in identifier", () => {
  assert.equal(isEmailIdentifier("a@b.com"), true);
  assert.equal(isEmailIdentifier("+8801712345678"), false);
});
