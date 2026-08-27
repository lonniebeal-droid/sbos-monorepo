/**
 * Assessment scoring logic for clinical instruments (PHQ-9, GAD-7, C-SSRS).
 *
 * Each instrument maps individual question responses (0-3 per item) to a
 * total score and a severity band. The functions are pure and deterministic.
 */

export type InstrumentId = 'PHQ-9' | 'GAD-7' | 'C-SSRS' | 'AUDIT' | 'DAST-10';

export interface SeverityBand {
  min: number;
  max: number;
  label: string;
}

export interface InstrumentDefinition {
  id: InstrumentId;
  questionCount: number;
  maxScore: number;
  severityBands: SeverityBand[];
}

/** PHQ-9 severity bands */
const PHQ9_BANDS: SeverityBand[] = [
  { min: 0, max: 4, label: 'Minimal' },
  { min: 5, max: 9, label: 'Mild' },
  { min: 10, max: 14, label: 'Moderate' },
  { min: 15, max: 19, label: 'Moderately Severe' },
  { min: 20, max: 27, label: 'Severe' },
];

/** GAD-7 severity bands */
const GAD7_BANDS: SeverityBand[] = [
  { min: 0, max: 4, label: 'Minimal' },
  { min: 5, max: 9, label: 'Mild' },
  { min: 10, max: 14, label: 'Moderate' },
  { min: 15, max: 21, label: 'Severe' },
];

/** C-SSRS severity bands (based on ideation section score) */
const CSSRS_BANDS: SeverityBand[] = [
  { min: 0, max: 0, label: 'No Ideation' },
  { min: 1, max: 2, label: 'Low Ideation' },
  { min: 3, max: 4, label: 'Moderate Ideation' },
  { min: 5, max: 25, label: 'High Ideation' },
];

export const INSTRUMENTS: Record<InstrumentId, InstrumentDefinition> = {
  'PHQ-9': {
    id: 'PHQ-9',
    questionCount: 9,
    maxScore: 27,
    severityBands: PHQ9_BANDS,
  },
  'GAD-7': {
    id: 'GAD-7',
    questionCount: 7,
    maxScore: 21,
    severityBands: GAD7_BANDS,
  },
  'C-SSRS': {
    id: 'C-SSRS',
    questionCount: 25,
    maxScore: 25,
    severityBands: CSSRS_BANDS,
  },
  AUDIT: {
    id: 'AUDIT',
    questionCount: 10,
    maxScore: 40,
    severityBands: [
      { min: 0, max: 7, label: 'Low Risk' },
      { min: 8, max: 15, label: 'Hazardous' },
      { min: 16, max: 19, label: 'Harmful' },
      { min: 20, max: 40, label: 'Possible Dependency' },
    ],
  },
  'DAST-10': {
    id: 'DAST-10',
    questionCount: 10,
    maxScore: 10,
    severityBands: [
      { min: 0, max: 0, label: 'No Problems' },
      { min: 1, max: 2, label: 'Low' },
      { min: 3, max: 5, label: 'Moderate' },
      { min: 6, max: 8, label: 'Substantial' },
      { min: 9, max: 10, label: 'Severe' },
    ],
  },
};

/**
 * Sum the values of a responses object (e.g. { q1: 2, q2: 1, ... }).
 * Non-numeric values are treated as 0.
 */
export function sumResponses(responses: Record<string, unknown>): number {
  let total = 0;
  for (const key of Object.keys(responses)) {
    const val = Number(responses[key]);
    if (!Number.isNaN(val)) {
      total += val;
    }
  }
  return total;
}

/**
 * Map a total score to a severity label using the instrument's bands.
 */
export function severityForScore(
  instrumentId: InstrumentId,
  score: number,
): string {
  const def = INSTRUMENTS[instrumentId];
  if (!def) return 'Unknown';
  for (const band of def.severityBands) {
    if (score >= band.min && score <= band.max) {
      return band.label;
    }
  }
  return def.severityBands[def.severityBands.length - 1]?.label ?? 'Unknown';
}

/**
 * Compute the score and severity from raw responses. Returns null if
 * responses is empty/undefined.
 */
export function scoreAssessment(
  instrumentId: InstrumentId,
  responses?: Record<string, unknown>,
): { score: number; severity: string } | null {
  if (!responses || Object.keys(responses).length === 0) return null;
  const score = sumResponses(responses);
  const severity = severityForScore(instrumentId, score);
  return { score, severity };
}
