import assert from "node:assert/strict";
import { test } from "node:test";

import { roundCurrency } from "./money.ts";

test("roundCurrency: rounds to two decimals", () => {
  assert.equal(roundCurrency(10), 10);
  assert.equal(roundCurrency(10.005), 10.01);
  assert.equal(roundCurrency(2.675), 2.68);
  assert.equal(roundCurrency(0.1 + 0.2), 0.3);
});
