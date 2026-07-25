import { Activity, CalendarCheck, TrendingUp, Users } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Reports" };

const utilization = [
  { clinician: "Dr. Chen", booked: 92 },
  { clinician: "Dr. Alvarez", booked: 78 },
  { clinician: "Dr. Patel", booked: 85 },
  { clinician: "Dr. Nguyen", booked: 64 },
];

const reportLinks = [
  "Revenue by payer",
  "No-show & cancellation trends",
  "Clinician productivity",
  "Outcome measures (PHQ-9 / GAD-7)",
  "Documentation compliance",
  "Accounts receivable aging",
];

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        description="Operational and clinical insights across your practice."
        actions={<Button variant="outline">Export</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sessions this month" value="1,284" icon={CalendarCheck} trend={{ value: "+9%", positive: true }} hint="vs. last month" />
        <StatCard label="New clients" value="37" icon={Users} trend={{ value: "+5", positive: true }} hint="this month" />
        <StatCard label="Utilization" value="80%" icon={Activity} hint="avg. across clinicians" />
        <StatCard label="Net revenue" value="$186k" icon={TrendingUp} trend={{ value: "+11%", positive: true }} hint="YTD" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Clinician utilization</CardTitle>
            <CardDescription>Percentage of available hours booked</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {utilization.map((row) => (
              <div key={row.clinician} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{row.clinician}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {row.booked}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${row.booked}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Standard reports</CardTitle>
            <CardDescription>Generate and export</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {reportLinks.map((link) => (
              <button
                key={link}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
              >
                {link}
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
