/**
 * Framework-agnostic scheduling logic shared across SBOS services.
 */

export type RecurrenceFrequencyName =
  | "NONE"
  | "DAILY"
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY";

export interface TimeWindow {
  start: Date;
  end: Date;
}

/** Whether two half-open time windows [start, end) overlap. */
export function windowsOverlap(a: TimeWindow, b: TimeWindow): boolean {
  return a.start < b.end && a.end > b.start;
}

/**
 * Advance a date by one recurrence step. Returns a new Date; the input is not
 * mutated. NONE returns the same instant.
 */
export function advanceByFrequency(
  date: Date,
  frequency: RecurrenceFrequencyName,
): Date {
  const next = new Date(date.getTime());
  switch (frequency) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "BIWEEKLY":
      next.setDate(next.getDate() + 14);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    case "NONE":
    default:
      break;
  }
  return next;
}

/**
 * Expand a recurring series into concrete start/end windows, preserving the
 * original duration. Generates up to `count` occurrences (including the first)
 * and never past `until` (inclusive). Returns [] for NONE beyond the first.
 */
export function expandRecurrence(params: {
  start: Date;
  end: Date;
  frequency: RecurrenceFrequencyName;
  count: number;
  until?: Date;
}): TimeWindow[] {
  const { start, end, frequency, count, until } = params;
  const durationMs = end.getTime() - start.getTime();
  if (durationMs <= 0 || count < 1) return [];

  const occurrences: TimeWindow[] = [];
  let cursor = new Date(start.getTime());

  for (let i = 0; i < count; i += 1) {
    if (until && cursor > until) break;
    occurrences.push({
      start: new Date(cursor.getTime()),
      end: new Date(cursor.getTime() + durationMs),
    });
    if (frequency === "NONE") break;
    cursor = advanceByFrequency(cursor, frequency);
  }

  return occurrences;
}

/** Minutes since midnight for an "HH:mm" string; NaN if malformed. */
export function minutesFromHHmm(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return Number.NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return Number.NaN;
  return hours * 60 + minutes;
}
