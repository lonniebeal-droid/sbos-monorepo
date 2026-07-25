import { Clock, Video } from "lucide-react";

import { tryApiFetch, type Paginated } from "@/lib/api";
import { formatTime, fullName, titleCaseEnum } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/page-header";
import { ApiErrorBanner } from "@/components/dashboard/api-state";
import {
  NewAppointmentDialog,
  type PickerOption,
} from "@/components/appointments/new-appointment-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Schedule" };

interface AppointmentRow {
  id: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  type: string;
  status: string;
  isTelehealth: boolean;
  client: { firstName: string; lastName: string } | null;
  location: { name: string } | null;
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
    case "CHECKED_IN":
    case "IN_SESSION":
      return "success" as const;
    case "CANCELLED":
    case "NO_SHOW":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

interface ClientPick {
  id: string;
  firstName: string;
  lastName: string;
}

export default async function SchedulePage() {
  const { from, to } = dayRange();
  const [res, clientsRes, cliniciansRes] = await Promise.all([
    tryApiFetch<Paginated<AppointmentRow>>(
      `/appointments?from=${from}&to=${to}&limit=50`,
    ),
    tryApiFetch<Paginated<ClientPick>>("/clients?limit=100"),
    tryApiFetch<PickerOption[]>("/clinicians"),
  ]);
  const agenda = res.ok ? res.data.data : [];
  const telehealthCount = agenda.filter((a) => a.isTelehealth).length;

  const clients: PickerOption[] = clientsRes.ok
    ? clientsRes.data.data.map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
      }))
    : [];
  const clinicians: PickerOption[] = cliniciansRes.ok ? cliniciansRes.data : [];

  return (
    <>
      <PageHeader
        title="Schedule"
        description="Appointments and clinician availability for the day."
        actions={
          <NewAppointmentDialog clients={clients} clinicians={clinicians} />
        }
      />

      {!res.ok && <ApiErrorBanner message={res.error} />}

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s agenda</CardTitle>
          <CardDescription>
            {agenda.length} appointment{agenda.length === 1 ? "" : "s"} ·{" "}
            {telehealthCount} telehealth
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {agenda.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No appointments scheduled for today.
            </p>
          ) : (
            agenda.map((slot) => (
              <div
                key={slot.id}
                className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-4">
                  <div className="w-24 shrink-0">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatTime(slot.startTime)}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> {slot.durationMinutes} min
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {slot.client ? fullName(slot.client) : "—"}
                      {slot.isTelehealth && (
                        <Video className="h-3.5 w-3.5 text-primary" />
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {titleCaseEnum(slot.type)}
                      {slot.location ? ` · ${slot.location.name}` : ""}
                    </p>
                  </div>
                </div>
                <Badge variant={statusVariant(slot.status)} className="w-fit">
                  {titleCaseEnum(slot.status)}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
