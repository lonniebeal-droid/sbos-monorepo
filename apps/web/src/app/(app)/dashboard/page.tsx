import {
  CalendarCheck,
  ClipboardList,
  DollarSign,
  Users,
} from "lucide-react";

import { getSession } from "@/lib/session";
import { tryApiFetch, type Paginated } from "@/lib/api";
import { formatCurrency, formatTime, fullName, titleCaseEnum } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { ApiErrorBanner } from "@/components/dashboard/api-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Dashboard" };

interface Overview {
  activeClients: number;
  clinicians: number;
  appointmentsThisMonth: number;
  notesToCosign: number;
  openTasks: number;
  collectedThisMonth: number;
  outstandingReceivables: number;
}

interface AppointmentRow {
  id: string;
  startTime: string;
  type: string;
  status: string;
  isTelehealth: boolean;
  client: { firstName: string; lastName: string } | null;
}

interface TaskRow {
  id: string;
  title: string;
  priority: string;
  dueDate: string | null;
}

function dayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

function statusVariant(status: string) {
  switch (status) {
    case "PENDING":
    case "SCHEDULED":
      return "secondary" as const;
    case "CHECKED_IN":
    case "IN_SESSION":
      return "success" as const;
    default:
      return "secondary" as const;
  }
}

export default async function DashboardPage() {
  const session = await getSession();
  const firstName = session?.name.split(" ")[0] ?? "there";
  const { from, to } = dayRange();

  const [overviewRes, apptRes, taskRes] = await Promise.all([
    tryApiFetch<Overview>("/analytics/overview"),
    tryApiFetch<Paginated<AppointmentRow>>(
      `/appointments?from=${from}&to=${to}&limit=8`,
    ),
    tryApiFetch<Paginated<TaskRow>>("/tasks?status=OPEN&limit=6"),
  ]);

  const overview = overviewRes.ok ? overviewRes.data : null;
  const appointments = apptRes.ok ? apptRes.data.data : [];
  const tasks = taskRes.ok ? taskRes.data.data : [];
  const unreachable = !overviewRes.ok ? overviewRes.error : null;

  return (
    <>
      <PageHeader
        title={`Good to see you, ${firstName}`}
        description="Here's what's happening across your practice today."
        actions={<Button>New appointment</Button>}
      />

      {unreachable && <ApiErrorBanner message={unreachable} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today's appointments"
          value={String(appointments.length)}
          icon={CalendarCheck}
        />
        <StatCard
          label="Active clients"
          value={overview ? String(overview.activeClients) : "—"}
          icon={Users}
        />
        <StatCard
          label="Notes to co-sign"
          value={overview ? String(overview.notesToCosign) : "—"}
          icon={ClipboardList}
        />
        <StatCard
          label="Outstanding A/R"
          value={overview ? formatCurrency(overview.outstandingReceivables) : "—"}
          icon={DollarSign}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Today's schedule</CardTitle>
              <CardDescription>
                {appointments.length} appointment
                {appointments.length === 1 ? "" : "s"}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              View calendar
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {appointments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No appointments scheduled for today.
              </p>
            ) : (
              appointments.map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-4">
                    <span className="w-20 text-sm font-medium tabular-nums text-muted-foreground">
                      {formatTime(slot.startTime)}
                    </span>
                    <div>
                      <p className="text-sm font-medium">
                        {slot.client ? fullName(slot.client) : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {titleCaseEnum(slot.type)}
                        {slot.isTelehealth ? " · Telehealth" : ""}
                      </p>
                    </div>
                  </div>
                  <Badge variant={statusVariant(slot.status)}>
                    {titleCaseEnum(slot.status)}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your tasks</CardTitle>
            <CardDescription>Open action items</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasks.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No open tasks.
              </p>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start justify-between gap-3 rounded-lg border p-3"
                >
                  <p className="text-sm">{task.title}</p>
                  <Badge variant="outline" className="shrink-0">
                    {titleCaseEnum(task.priority)}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
