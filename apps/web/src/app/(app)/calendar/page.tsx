import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { tryApiFetch, type Paginated } from "@/lib/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { ApiErrorBanner } from "@/components/dashboard/api-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Calendar" };

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface AppointmentRow {
  id: string;
  startTime: string;
}

function buildMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const today = now.getDate();

  const parsedYear = Number(params.year);
  const parsedMonth = Number(params.month);
  const hasValidParams =
    Number.isInteger(parsedYear) &&
    Number.isInteger(parsedMonth) &&
    parsedMonth >= 0 &&
    parsedMonth <= 11;

  const year = hasValidParams ? parsedYear : currentYear;
  const month = hasValidParams ? parsedMonth : currentMonth;
  const isCurrentMonth = year === currentYear && month === currentMonth;

  const from = new Date(year, month, 1).toISOString();
  const to = new Date(year, month + 1, 1).toISOString();
  const res = await tryApiFetch<Paginated<AppointmentRow>>(
    `/appointments?from=${from}&to=${to}&limit=100`,
  );

  const appointmentsByDay: Record<number, number> = {};
  if (res.ok) {
    for (const appt of res.data.data) {
      const day = new Date(appt.startTime).getDate();
      appointmentsByDay[day] = (appointmentsByDay[day] ?? 0) + 1;
    }
  }

  const cells = buildMonthGrid(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  const monthHref = (y: number, m: number) => `/calendar?year=${y}&month=${m}`;

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Month view of all scheduled appointments."
        actions={
          <Button>
            <Plus className="h-4 w-4" /> New appointment
          </Button>
        }
      />

      {!res.ok && <ApiErrorBanner message={res.error} />}

      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{monthLabel}</h2>
            <div className="flex items-center gap-1">
              <Button asChild variant="outline" size="icon" aria-label="Previous month">
                <Link href={monthHref(prevYear, prevMonth)}>
                  <ChevronLeft className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/calendar">Today</Link>
              </Button>
              <Button asChild variant="outline" size="icon" aria-label="Next month">
                <Link href={monthHref(nextYear, nextMonth)}>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
            {weekdays.map((day) => (
              <div
                key={day}
                className="bg-muted/50 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {day}
              </div>
            ))}
            {cells.map((day, index) => {
              const count = day ? appointmentsByDay[day] : undefined;
              const isToday = isCurrentMonth && day === today;
              return (
                <div
                  key={index}
                  className={cn(
                    "min-h-24 bg-background p-2 text-sm",
                    !day && "bg-muted/20",
                  )}
                >
                  {day && (
                    <>
                      <span
                        className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                          isToday
                            ? "bg-primary font-semibold text-primary-foreground"
                            : "text-foreground",
                        )}
                      >
                        {day}
                      </span>
                      {count ? (
                        <div className="mt-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                          {count} appt{count === 1 ? "" : "s"}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
