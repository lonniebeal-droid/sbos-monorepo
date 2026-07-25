/**
 * @sbos/core — shared primitives for the Service Brand Operating System.
 */

export interface ServiceRecord {
  id: string;
  name: string;
  status: "active" | "inactive";
}

/**
 * Format a service record into a single human-readable line.
 */
export function formatServiceRecord(record: ServiceRecord): string {
  return `[${record.status.toUpperCase()}] ${record.name} (${record.id})`;
}
