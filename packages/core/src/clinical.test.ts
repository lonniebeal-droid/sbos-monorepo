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

test('roleSatisfies: ORG_ADMIN never satisfies SUPER_ADMIN', () => {
  assert.equal(roleSatisfies('ORG_ADMIN', 'SUPER_ADMIN'), false);
});

test("roleSatisfies: lower roles do not satisfy higher requirements", () => {
  assert.equal(roleSatisfies("CLINICIAN", "ORG_ADMIN"), false);
  assert.equal(roleSatisfies("FRONT_DESK", "SUPERVISOR"), false);
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
