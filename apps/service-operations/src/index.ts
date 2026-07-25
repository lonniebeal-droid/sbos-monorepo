import { formatServiceRecord, type ServiceRecord } from "@sbos/core";
import { buildDailyReport } from "./reports/daily-report.js";

const records: ServiceRecord[] = [
  { id: "svc-001", name: "Intake Coordination", status: "active" },
  { id: "svc-002", name: "Legacy Onboarding", status: "inactive" },
];

for (const record of records) {
  console.log(formatServiceRecord(record));
}

console.log(buildDailyReport(records));
