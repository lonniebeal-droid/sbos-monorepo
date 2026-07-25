import assert from "node:assert/strict";
import { test } from "node:test";

import {
  advanceByFrequency,
  expandRecurrence,
  minutesFromHHmm,
  windowsOverlap,
} from "./scheduling.ts";

test("windowsOverlap: detects overlap and adjacency", () => {
  const a = { start: new Date("2026-07-24T09:00:00Z"), end: new Date("2026-07-24T10:00:00Z") };
  const overlapping = { start: new Date("2026-07-24T09:30:00Z"), end: new Date("2026-07-24T10:30:00Z") };
  const adjacent = { start: new Date("2026-07-24T10:00:00Z"), end: new Date("2026-07-24T11:00:00Z") };
  assert.equal(windowsOverlap(a, overlapping), true);
  assert.equal(windowsOverlap(a, adjacent), false); // half-open: touching is not overlap
});

test("advanceByFrequency: steps forward without mutating input", () => {
  const base = new Date("2026-07-24T09:00:00Z");
  const weekly = advanceByFrequency(base, "WEEKLY");
  assert.equal(weekly.toISOString(), "2026-07-31T09:00:00.000Z");
  assert.equal(base.toISOString(), "2026-07-24T09:00:00.000Z");
  assert.equal(advanceByFrequency(base, "NONE").getTime(), base.getTime());
});

test("expandRecurrence: generates N occurrences preserving duration", () => {
  const occ = expandRecurrence({
    start: new Date("2026-07-24T09:00:00Z"),
    end: new Date("2026-07-24T09:50:00Z"),
    frequency: "WEEKLY",
    count: 3,
  });
  assert.equal(occ.length, 3);
  assert.equal(occ[1].start.toISOString(), "2026-07-31T09:00:00.000Z");
  assert.equal(occ[2].end.toISOString(), "2026-08-07T09:50:00.000Z");
});

test("expandRecurrence: respects the until bound", () => {
  const occ = expandRecurrence({
    start: new Date("2026-07-24T09:00:00Z"),
    end: new Date("2026-07-24T09:50:00Z"),
    frequency: "WEEKLY",
    count: 10,
    until: new Date("2026-08-05T00:00:00Z"),
  });
  assert.equal(occ.length, 2); // 07-24 and 07-31 only
});

test("minutesFromHHmm: parses and validates", () => {
  assert.equal(minutesFromHHmm("09:30"), 570);
  assert.equal(minutesFromHHmm("00:00"), 0);
  assert.ok(Number.isNaN(minutesFromHHmm("25:00")));
  assert.ok(Number.isNaN(minutesFromHHmm("bad")));
});
