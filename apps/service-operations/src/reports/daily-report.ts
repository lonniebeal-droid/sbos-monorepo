import { formatServiceRecord, type ServiceRecord } from "@sbos/core";

/**
 * Build a plain-text daily operations report from a set of service records.
 */
export function buildDailyReport(records: ServiceRecord[]): string {
  const active = records.filter((record) => record.status === "active");
  const lines = [
    "=== SBOS Daily Report ===",
    `Total services: ${records.length}`,
    `Active services: ${active.length}`,
    "",
    ...records.map((record) => `  - ${formatServiceRecord(record)}`),
  ];
  return lines.join("\n");
}
