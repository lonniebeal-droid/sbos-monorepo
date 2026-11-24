"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { publicApiBaseUrl } from "@/lib/public-api";

function toCsvRow(values: (string | number)[]): string {
  return values
    .map((v) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    })
    .join(",");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportReportsButton() {
  const [loading, setLoading] = useState(false);

  async function onExport() {
    setLoading(true);
    try {
      const token = document.cookie
        .split("; ")
        .find((c) => c.startsWith("sbos_access_token="))
        ?.split("=")[1];

      const baseUrl = publicApiBaseUrl();

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const [overviewRes, apptRes, claimsRes] = await Promise.all([
        fetch(`${baseUrl}/api/v1/analytics/overview`, { headers }).then((r) =>
          r.json(),
        ),
        fetch(`${baseUrl}/api/v1/analytics/appointments-by-status`, {
          headers,
        }).then((r) => r.json()),
        fetch(`${baseUrl}/api/v1/analytics/claims-by-status`, { headers }).then(
          (r) => r.json(),
        ),
      ]);

      const lines: string[] = [];

      lines.push(toCsvRow(["Practice Overview"]));
      lines.push(toCsvRow(["Metric", "Value"]));
      lines.push(toCsvRow(["Active Clients", overviewRes.activeClients ?? 0]));
      lines.push(toCsvRow(["Clinicians", overviewRes.clinicians ?? 0]));
      lines.push(
        toCsvRow([
          "Appointments This Month",
          overviewRes.appointmentsThisMonth ?? 0,
        ]),
      );
      lines.push(
        toCsvRow([
          "Collected This Month",
          `$${(overviewRes.collectedThisMonth ?? 0).toLocaleString()}`,
        ]),
      );
      lines.push("");

      lines.push(toCsvRow(["Appointments by Status"]));
      lines.push(toCsvRow(["Status", "Count"]));
      for (const row of apptRes) {
        lines.push(toCsvRow([row.status, row.count]));
      }
      lines.push("");

      lines.push(toCsvRow(["Claims by Status"]));
      lines.push(toCsvRow(["Status", "Count", "Total Billed"]));
      for (const row of claimsRes) {
        lines.push(toCsvRow([row.status, row.count, `$${(row.totalBilled ?? 0).toLocaleString()}`]));
      }

      const date = new Date().toISOString().split("T")[0];
      downloadCsv(`sbos-report-${date}.csv`, lines.join("\n"));
      toast.success("Report exported");
    } catch {
      toast.error("Failed to export report. Is the API running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" onClick={onExport} disabled={loading}>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      Export CSV
    </Button>
  );
}
