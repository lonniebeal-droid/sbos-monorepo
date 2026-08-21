import { Activity, CalendarCheck, TrendingUp, Users } from "lucide-react";

import { tryApiFetch } from "@/lib/api";
import { formatCurrency, titleCaseEnum } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { ApiErrorBanner } from "@/components/dashboard/api-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Reports" };

interface Overview {
  activeClients: number;
  clinicians: number;
  appointmentsThisMonth: number;
  collectedThisMonth: number;
}

interface StatusRow {
  status: string;
  count: number;
}

export default async function ReportsPage() {
  const [overviewRes, apptStatusRes] = await Promise.all([
    tryApiFetch<Overview>("/analytics/overview"),
    tryApiFetch<StatusRow[]>("/analytics/appointments-by-status"),
  ]);

  const overview = overviewRes.ok ? overviewRes.data : null;
  const apptStatus = apptStatusRes.ok ? apptStatusRes.data : [];
  const totalAppts = apptStatus.reduce((sum, r) => sum + r.count, 0);
  const maxCount = Math.max(1, ...apptStatus.map((r) => r.count));

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        description="Operational insights across your business."
        actions={<Button variant="outline">Export</Button>}
      />

      {!overviewRes.ok && <ApiErrorBanner message={overviewRes.error} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Appointments this month"
          value={overview ? String(overview.appointmentsThisMonth) : "—"}
          icon={CalendarCheck}
        />
        <StatCard
          label="Active clients"
          value={overview ? String(overview.activeClients) : "—"}
          icon={Users}
        />
        <StatCard
          label="Clinicians"
          value={overview ? String(overview.clinicians) : "—"}
          icon={Activity}
        />
        <StatCard
          label="Collected (MTD)"
          value={overview ? formatCurrency(overview.collectedThisMonth) : "—"}
          icon={TrendingUp}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appointments by status</CardTitle>
          <CardDescription>
            {totalAppts} appointment{totalAppts === 1 ? "" : "s"} across all time
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {apptStatus.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No appointment data yet.
            </p>
          ) : (
            apptStatus.map((row) => (
              <div key={row.status} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{titleCaseEnum(row.status)}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {row.count}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(row.count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
