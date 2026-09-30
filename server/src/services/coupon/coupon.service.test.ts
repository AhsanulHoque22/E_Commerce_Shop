import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDiscount } from "./coupon.service.js";

test("computeDiscount: percent applies the raw percentage", () => {
  assert.equal(computeDiscount("percent", 10, 1000), 100);
});

test("computeDiscount: percent is capped by maxDiscount", () => {
  assert.equal(computeDiscount("percent", 50, 1000, 200), 200);
});

test("computeDiscount: percent never exceeds subtotal even without a cap", () => {
  assert.equal(computeDiscount("percent", 150, 100), 100);
});

test("computeDiscount: fixed returns the flat amount", () => {
  assert.equal(computeDiscount("fixed", 150, 1000), 150);
});

test("computeDiscount: fixed never exceeds subtotal", () => {
  assert.equal(computeDiscount("fixed", 500, 200), 200);
});

test("computeDiscount: zero subtotal yields zero discount", () => {
  assert.equal(computeDiscount("percent", 10, 0), 0);
  assert.equal(computeDiscount("fixed", 50, 0), 0);
});
