import assert from "node:assert/strict";
import { test } from "node:test";

import {
  sumResponses,
  severityForScore,
  scoreAssessment,
  INSTRUMENTS,
} from "./assessments.ts";

test("sumResponses: sums numeric response values", () => {
  assert.equal(sumResponses({ q1: 2, q2: 1, q3: 3 }), 6);
});

test("sumResponses: treats non-numeric values as 0", () => {
  assert.equal(sumResponses({ q1: "yes", q2: 2 }), 2);
});

test("sumResponses: returns 0 for empty object", () => {
  assert.equal(sumResponses({}), 0);
});

test("severityForScore: PHQ-9 maps 0-4 to Minimal", () => {
  assert.equal(severityForScore("PHQ-9", 0), "Minimal");
  assert.equal(severityForScore("PHQ-9", 4), "Minimal");
});

test("severityForScore: PHQ-9 maps 10-14 to Moderate", () => {
  assert.equal(severityForScore("PHQ-9", 10), "Moderate");
  assert.equal(severityForScore("PHQ-9", 14), "Moderate");
});

test("severityForScore: PHQ-9 maps 20+ to Severe", () => {
  assert.equal(severityForScore("PHQ-9", 27), "Severe");
});

test("severityForScore: GAD-7 maps 15-21 to Severe", () => {
  assert.equal(severityForScore("GAD-7", 15), "Severe");
  assert.equal(severityForScore("GAD-7", 21), "Severe");
});

test("severityForScore: returns Unknown for unknown instrument", () => {
  assert.equal(severityForScore("FAKE" as never, 5), "Unknown");
});

test("scoreAssessment: returns null for undefined responses", () => {
  assert.equal(scoreAssessment("PHQ-9", undefined), null);
});

test("scoreAssessment: returns null for empty responses", () => {
  assert.equal(scoreAssessment("PHQ-9", {}), null);
});

test("scoreAssessment: computes PHQ-9 score and severity", () => {
  const responses = { q1: 2, q2: 1, q3: 2, q4: 3, q5: 1, q6: 0, q7: 1, q8: 1, q9: 0 };
  const result = scoreAssessment("PHQ-9", responses);
  assert.deepEqual(result, { score: 11, severity: "Moderate" });
});

test("scoreAssessment: computes GAD-7 score from responses", () => {
  const responses = { q1: 2, q2: 2, q3: 1, q4: 1, q5: 0, q6: 1, q7: 0 };
  const result = scoreAssessment("GAD-7", responses);
  assert.deepEqual(result, { score: 7, severity: "Mild" });
});

test("INSTRUMENTS: PHQ-9 has 9 questions and max score 27", () => {
  assert.equal(INSTRUMENTS["PHQ-9"].questionCount, 9);
  assert.equal(INSTRUMENTS["PHQ-9"].maxScore, 27);
});

test("INSTRUMENTS: GAD-7 has 7 questions and max score 21", () => {
  assert.equal(INSTRUMENTS["GAD-7"].questionCount, 7);
  assert.equal(INSTRUMENTS["GAD-7"].maxScore, 21);
});
