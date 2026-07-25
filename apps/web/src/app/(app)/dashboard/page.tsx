import {
  CalendarCheck,
  ClipboardList,
  DollarSign,
  Users,
} from "lucide-react";

import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
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

const todaysSchedule = [
  { time: "9:00 AM", client: "Jordan M.", type: "Individual · 50 min", status: "Confirmed" },
  { time: "10:00 AM", client: "Priya S.", type: "Intake · 60 min", status: "Confirmed" },
  { time: "11:30 AM", client: "Marcus T.", type: "Telehealth · 45 min", status: "Checked in" },
  { time: "1:00 PM", client: "Group A", type: "Group · 90 min", status: "Confirmed" },
  { time: "3:00 PM", client: "Elena R.", type: "Individual · 50 min", status: "Pending" },
];

const tasks = [
  { label: "Co-sign 3 progress notes", due: "Today" },
  { label: "Submit 2 insurance claims", due: "Today" },
  { label: "Review updated treatment plan — Jordan M.", due: "Tomorrow" },
  { label: "Complete credentialing renewal", due: "In 5 days" },
];

export default async function DashboardPage() {
  const session = await getSession();
  const firstName = session?.name.split(" ")[0] ?? "there";

  return (
    <>
      <PageHeader
        title={`Good to see you, ${firstName}`}
        description="Here's what's happening across your practice today."
        actions={<Button>New appointment</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today's appointments"
          value="12"
          icon={CalendarCheck}
          trend={{ value: "+3", positive: true }}
          hint="vs. yesterday"
        />
        <StatCard
          label="Active clients"
          value="248"
          icon={Users}
          trend={{ value: "+8", positive: true }}
          hint="this month"
        />
        <StatCard
          label="Notes to co-sign"
          value="7"
          icon={ClipboardList}
          hint="3 overdue"
        />
        <StatCard
          label="Outstanding A/R"
          value="$18,420"
          icon={DollarSign}
          trend={{ value: "-6%", positive: true }}
          hint="past 30 days"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Today's schedule</CardTitle>
              <CardDescription>Wednesday, {formattedDate()}</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              View calendar
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {todaysSchedule.map((slot) => (
              <div
                key={`${slot.time}-${slot.client}`}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-4">
                  <span className="w-20 text-sm font-medium tabular-nums text-muted-foreground">
                    {slot.time}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{slot.client}</p>
                    <p className="text-xs text-muted-foreground">{slot.type}</p>
                  </div>
                </div>
                <Badge
                  variant={
                    slot.status === "Pending"
                      ? "warning"
                      : slot.status === "Checked in"
                        ? "success"
                        : "secondary"
                  }
                >
                  {slot.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your tasks</CardTitle>
            <CardDescription>Action items awaiting you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.label}
                className="flex items-start justify-between gap-3 rounded-lg border p-3"
              >
                <p className="text-sm">{task.label}</p>
                <Badge variant="outline" className="shrink-0">
                  {task.due}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function formattedDate() {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
