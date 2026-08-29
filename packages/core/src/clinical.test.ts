import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isNoteEditable,
  noteStatusAfterSign,
  roleSatisfies,
  roleSatisfiesAny,
} from "./clinical.ts";

test("roleSatisfies: higher roles satisfy lower requirements", () => {
  assert.equal(roleSatisfies("ORG_ADMIN", "CLINICIAN"), true);
  assert.equal(roleSatisfies("SUPER_ADMIN", "FRONT_DESK"), true);
  assert.equal(roleSatisfies("CLINICIAN", "CLINICIAN"), true);
});

test("roleSatisfies: lower roles do not satisfy higher requirements", () => {
  assert.equal(roleSatisfies("CLINICIAN", "ORG_ADMIN"), false);
  assert.equal(roleSatisfies("FRONT_DESK", "SUPERVISOR"), false);
});


test("roleSatisfies: functional roles are isolated (CLINICIAN/BILLING/FRONT_DESK)", () => {
  assert.equal(roleSatisfies("CLINICIAN", "BILLING"), false);
  assert.equal(roleSatisfies("CLINICIAN", "FRONT_DESK"), false);
  assert.equal(roleSatisfies("BILLING", "CLINICIAN"), false);
  assert.equal(roleSatisfies("BILLING", "FRONT_DESK"), false);
  assert.equal(roleSatisfies("FRONT_DESK", "CLINICIAN"), false);
  assert.equal(roleSatisfies("FRONT_DESK", "BILLING"), false);
  assert.equal(roleSatisfies("SUPERVISOR", "BILLING"), false);
  assert.equal(roleSatisfies("SUPERVISOR", "FRONT_DESK"), false);
  assert.equal(roleSatisfies("SUPERVISOR", "CLINICIAN"), true);
});


test("roleSatisfies: ORG_ADMIN does not satisfy SUPER_ADMIN", () => {
  assert.equal(roleSatisfies("ORG_ADMIN", "SUPER_ADMIN"), false);
  assert.equal(roleSatisfies("SUPER_ADMIN", "SUPER_ADMIN"), true);
  assert.equal(roleSatisfies("SUPER_ADMIN", "ORG_ADMIN"), true);
});

test("roleSatisfiesAny: matches when any requirement is met", () => {
  assert.equal(roleSatisfiesAny("BILLING", ["ORG_ADMIN", "BILLING"]), true);
  assert.equal(roleSatisfiesAny("FRONT_DESK", ["CLINICIAN"]), false);
});

test("isNoteEditable: only drafts and pending co-sign are editable", () => {
  assert.equal(isNoteEditable("DRAFT"), true);
  assert.equal(isNoteEditable("PENDING_COSIGN"), true);
  assert.equal(isNoteEditable("SIGNED"), false);
  assert.equal(isNoteEditable("AMENDED"), false);
  assert.equal(isNoteEditable("LOCKED"), false);
});

test("noteStatusAfterSign: routes to co-sign when required", () => {
  assert.equal(noteStatusAfterSign(true), "PENDING_COSIGN");
  assert.equal(noteStatusAfterSign(false), "SIGNED");
});
