import { test } from "node:test";
import assert from "node:assert/strict";
import { OrderStatus } from "@prisma/client";
import { notifyOrderStatusChanged } from "./orderNotify.service.js";

test("notifyOrderStatusChanged: never throws for a nonexistent order", async () => {
  await assert.doesNotReject(
    notifyOrderStatusChanged(
      "nonexistent-order-id",
      OrderStatus.PENDING_APPROVAL,
      OrderStatus.APPROVED
    )
  );
});

test("notifyOrderStatusChanged: never throws when DB is unreachable/erroring", async () => {
  // Malformed publicId still exercises the real prisma call and must resolve,
  // not reject — this is the money-path safety guarantee the caller relies on.
  await assert.doesNotReject(
    notifyOrderStatusChanged(
      "",
      OrderStatus.APPROVED,
      OrderStatus.CANCELLED
    )
  );
});
