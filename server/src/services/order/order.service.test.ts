import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAdvancePercent } from "./order.service.js";
import { AppError } from "../../utils/AppError.js";

test("computeAdvancePercent: 100% when all lines ready-to-ship and in stock", () => {
  const { advancePercent, reason } = computeAdvancePercent([
    { stock: 5, quantity: 1, readyToShip: true },
    { stock: 2, quantity: 2, readyToShip: true },
  ]);
  assert.equal(advancePercent, 100);
  assert.equal(reason, "ready_to_ship");
});

test("computeAdvancePercent: 10% when any line is a preorder", () => {
  const { advancePercent, reason } = computeAdvancePercent([
    { stock: 5, quantity: 1, readyToShip: true },
    { stock: 5, quantity: 1, readyToShip: false },
  ]);
  assert.equal(advancePercent, 10);
  assert.equal(reason, "preorder_or_not_ready");
});

test("computeAdvancePercent: throws when a line exceeds available stock", () => {
  assert.throws(
    () =>
      computeAdvancePercent([{ stock: 1, quantity: 2, readyToShip: true }]),
    AppError
  );
});
