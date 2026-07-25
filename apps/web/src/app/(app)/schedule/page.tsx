import { Clock, Plus, Video } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Schedule" };

const agenda = [
  { time: "9:00 AM", duration: "50 min", client: "Jordan Mitchell", type: "Individual therapy", clinician: "Dr. Chen", telehealth: false, status: "Confirmed" },
  { time: "10:00 AM", duration: "60 min", client: "Priya Shah", type: "Intake assessment", clinician: "Dr. Chen", telehealth: false, status: "Confirmed" },
  { time: "11:30 AM", duration: "45 min", client: "Marcus Turner", type: "Follow-up", clinician: "Dr. Alvarez", telehealth: true, status: "Checked in" },
  { time: "1:00 PM", duration: "90 min", client: "DBT Skills Group", type: "Group session", clinician: "Dr. Patel", telehealth: false, status: "Confirmed" },
  { time: "3:00 PM", duration: "50 min", client: "Elena Rodriguez", type: "Individual therapy", clinician: "Dr. Chen", telehealth: true, status: "Pending" },
];

export default function SchedulePage() {
  return (
    <>
      <PageHeader
        title="Schedule"
        description="Appointments and clinician availability for the day."
        actions={
          <Button>
            <Plus className="h-4 w-4" /> New appointment
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s agenda</CardTitle>
          <CardDescription>5 appointments · 2 telehealth</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {agenda.map((slot) => (
            <div
              key={`${slot.time}-${slot.client}`}
              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-4">
                <div className="w-24 shrink-0">
                  <p className="text-sm font-semibold tabular-nums">{slot.time}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> {slot.duration}
                  </p>
                </div>
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {slot.client}
                    {slot.telehealth && (
                      <Video className="h-3.5 w-3.5 text-primary" />
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {slot.type} · {slot.clinician}
                  </p>
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
                className="w-fit"
              >
                {slot.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
