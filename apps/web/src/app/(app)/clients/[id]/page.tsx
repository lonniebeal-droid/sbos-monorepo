import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, FileText, Pill, Stethoscope, ClipboardCheck } from "lucide-react";

import { apiFetch, ApiError, tryApiFetch, type Paginated } from "@/lib/api";
import { formatDate, titleCaseEnum } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/page-header";
import { EditClientDialog } from "@/components/clients/edit-client-dialog";
import { AddDiagnosisDialog } from "@/components/clients/add-diagnosis-dialog";
import { AddMedicationDialog } from "@/components/clients/add-medication-dialog";
import { AddAssessmentDialog } from "@/components/clients/add-assessment-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata = { title: "Client chart" };

interface ClientChart {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  dateOfBirth: string;
  gender: string;
  status: string;
  email: string | null;
  phone: string | null;
  diagnoses: Array<{
    id: string;
    icd10Code: string;
    description: string;
    type: string;
    status: string;
  }>;
  insurancePolicies: Array<{
    id: string;
    payerName: string;
    memberId: string;
    type: string;
  }>;
  treatmentPlans: Array<{
    id: string;
    title: string;
    status: string;
    goals: Array<{ id: string; description: string; progressPercent: number }>;
  }>;
}

interface NoteRow {
  id: string;
  type: string;
  status: string;
  createdAt: string;
}
interface MedicationRow {
  id: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  status: string;
}
interface AppointmentRow {
  id: string;
  startTime: string;
  type: string;
  status: string;
}
interface AssessmentRow {
  id: string;
  instrument: string;
  score: number | null;
  severity: string | null;
  administeredAt: string;
}

function age(dob: string): number {
  const diff = Date.now() - new Date(dob).getTime();
  return Math.abs(new Date(diff).getUTCFullYear() - 1970);
}

export default async function ClientChartPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let client: ClientChart;
  try {
    client = await apiFetch<ClientChart>(`/clients/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    // API unreachable / no DB — show a minimal not-available chart.
    return (
      <>
        <BackLink />
        <PageHeader title="Client chart" description="Client details are unavailable." />
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {error instanceof ApiError
              ? error.message
              : "Unable to load this client."}
          </CardContent>
        </Card>
      </>
    );
  }

  const [notesRes, medsRes, apptRes, assessRes] = await Promise.all([
    tryApiFetch<Paginated<NoteRow>>(`/notes?clientId=${id}&limit=25`),
    tryApiFetch<MedicationRow[]>(`/medications?clientId=${id}`),
    tryApiFetch<Paginated<AppointmentRow>>(`/appointments?clientId=${id}&limit=25`),
    tryApiFetch<AssessmentRow[]>(`/assessments?clientId=${id}`),
  ]);
  const notes = notesRes.ok ? notesRes.data.data : [];
  const meds = medsRes.ok ? medsRes.data : [];
  const appts = apptRes.ok ? apptRes.data.data : [];
  const assessments = assessRes.ok ? assessRes.data : [];

  const displayName =
    `${client.firstName} ${client.lastName}` +
    (client.preferredName ? ` (${client.preferredName})` : "");

  return (
    <>
      <BackLink />
      <PageHeader
        title={displayName}
        description={`MRN ${client.mrn} · ${age(client.dateOfBirth)} yrs · ${titleCaseEnum(client.gender)}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{titleCaseEnum(client.status)}</Badge>
            <EditClientDialog client={client} />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-5">
        <StatMini icon={Stethoscope} label="Diagnoses" value={client.diagnoses.length} />
        <StatMini icon={Pill} label="Medications" value={meds.length} />
        <StatMini icon={ClipboardCheck} label="Assessments" value={assessments.length} />
        <StatMini icon={FileText} label="Notes" value={notes.length} />
        <StatMini icon={CalendarDays} label="Appointments" value={appts.length} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="diagnoses">Diagnoses</TabsTrigger>
          <TabsTrigger value="medications">Medications</TabsTrigger>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="plans">Treatment Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Demographics & contact</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
              <Field label="Date of birth" value={formatDate(client.dateOfBirth)} />
              <Field label="Gender" value={titleCaseEnum(client.gender)} />
              <Field label="Email" value={client.email ?? "—"} />
              <Field label="Phone" value={client.phone ?? "—"} />
              <Field
                label="Insurance"
                value={
                  client.insurancePolicies.length > 0
                    ? client.insurancePolicies
                        .map((p) => `${p.payerName} (${titleCaseEnum(p.type)})`)
                        .join(", ")
                    : "None on file"
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diagnoses">
          <div className="mb-4 flex justify-end">
            <AddDiagnosisDialog clientId={id} />
          </div>
          <ListCard
            empty="No diagnoses recorded."
            items={client.diagnoses.map((d) => ({
              id: d.id,
              primary: `${d.icd10Code} — ${d.description}`,
              secondary: titleCaseEnum(d.type),
              badge: titleCaseEnum(d.status),
            }))}
          />
        </TabsContent>

        <TabsContent value="medications">
          <div className="mb-4 flex justify-end">
            <AddMedicationDialog clientId={id} />
          </div>
          <ListCard
            empty="No medications recorded."
            items={meds.map((m) => ({
              id: m.id,
              primary: m.name,
              secondary: [m.dosage, m.frequency].filter(Boolean).join(" · ") || "—",
              badge: titleCaseEnum(m.status),
            }))}
          />
        </TabsContent>

        <TabsContent value="assessments">
          <div className="mb-4 flex justify-end">
            <AddAssessmentDialog clientId={id} />
          </div>
          {assessments.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No assessments recorded.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="divide-y p-0">
                {assessments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium">{a.instrument}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(a.administeredAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      {a.score != null && (
                        <p className="text-sm font-semibold tabular-nums">
                          Score: {a.score}
                        </p>
                      )}
                      {a.severity && (
                        <Badge variant="outline">{a.severity}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="notes">
          <ListCard
            empty="No notes yet."
            items={notes.map((n) => ({
              id: n.id,
              primary: `${n.type} note`,
              secondary: formatDate(n.createdAt),
              badge: titleCaseEnum(n.status),
              href: `/notes/${n.id}`,
            }))}
          />
        </TabsContent>

        <TabsContent value="plans">
          {client.treatmentPlans.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No treatment plans yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {client.treatmentPlans.map((plan) => (
                <Card key={plan.id}>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">{plan.title}</CardTitle>
                    <Badge variant="secondary">{titleCaseEnum(plan.status)}</Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {plan.goals.map((goal) => (
                      <div key={goal.id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{goal.description}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {goal.progressPercent}%
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${goal.progressPercent}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

function BackLink() {
  return (
    <Link
      href="/clients"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> Back to clients
    </Link>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function StatMini({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Stethoscope;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-lg font-semibold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ListCard({
  items,
  empty,
}: {
  items: Array<{
    id: string;
    primary: string;
    secondary: string;
    badge: string;
    href?: string;
  }>;
  empty: string;
}) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {empty}
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="divide-y p-0">
        {items.map((item) => {
          const inner = (
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium">{item.primary}</p>
                <p className="text-xs text-muted-foreground">{item.secondary}</p>
              </div>
              <Badge variant="outline">{item.badge}</Badge>
            </div>
          );
          return item.href ? (
            <Link
              key={item.id}
              href={item.href}
              className="block transition-colors hover:bg-accent/50"
            >
              {inner}
            </Link>
          ) : (
            <div key={item.id}>{inner}</div>
          );
        })}
      </CardContent>
    </Card>
  );
}
