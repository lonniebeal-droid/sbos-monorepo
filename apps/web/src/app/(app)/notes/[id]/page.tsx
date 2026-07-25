import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { formatDate, titleCaseEnum } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/page-header";
import { NoteActions } from "@/components/notes/note-actions";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Note" };

interface NoteDetail {
  id: string;
  type: string;
  status: string;
  title: string | null;
  content: string | null;
  createdAt: string;
  signedAt: string | null;
  cosignedAt: string | null;
  client: { firstName: string; lastName: string; mrn: string } | null;
  birp: {
    behavior: string;
    intervention: string;
    response: string;
    plan: string;
  } | null;
  dap: { data: string; assessment: string; plan: string } | null;
  soap: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  } | null;
}

function statusVariant(status: string) {
  switch (status) {
    case "SIGNED":
      return "success" as const;
    case "DRAFT":
      return "secondary" as const;
    default:
      return "warning" as const;
  }
}

function Section({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="whitespace-pre-wrap text-sm">{value}</p>
    </div>
  );
}

export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let note: NoteDetail;
  try {
    note = await apiFetch<NoteDetail>(`/notes/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    return (
      <>
        <Link
          href="/notes"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to notes
        </Link>
        <PageHeader title="Note" description="This note is unavailable." />
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {error instanceof ApiError ? error.message : "Unable to load this note."}
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <Link
        href="/notes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to notes
      </Link>

      <PageHeader
        title={note.title ?? `${note.type} note`}
        description={
          note.client
            ? `${note.client.firstName} ${note.client.lastName} · MRN ${note.client.mrn} · ${formatDate(note.createdAt)}`
            : formatDate(note.createdAt)
        }
        actions={<NoteActions noteId={note.id} status={note.status} />}
      />

      <div className="flex items-center gap-2">
        <Badge variant="outline">{note.type}</Badge>
        <Badge variant={statusVariant(note.status)}>
          {titleCaseEnum(note.status)}
        </Badge>
        {note.signedAt && (
          <span className="text-xs text-muted-foreground">
            Signed {formatDate(note.signedAt)}
          </span>
        )}
        {note.cosignedAt && (
          <span className="text-xs text-muted-foreground">
            · Co-signed {formatDate(note.cosignedAt)}
          </span>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documentation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {note.birp && (
            <>
              <Section label="Behavior" value={note.birp.behavior} />
              <Section label="Intervention" value={note.birp.intervention} />
              <Section label="Response" value={note.birp.response} />
              <Section label="Plan" value={note.birp.plan} />
            </>
          )}
          {note.dap && (
            <>
              <Section label="Data" value={note.dap.data} />
              <Section label="Assessment" value={note.dap.assessment} />
              <Section label="Plan" value={note.dap.plan} />
            </>
          )}
          {note.soap && (
            <>
              <Section label="Subjective" value={note.soap.subjective} />
              <Section label="Objective" value={note.soap.objective} />
              <Section label="Assessment" value={note.soap.assessment} />
              <Section label="Plan" value={note.soap.plan} />
            </>
          )}
          {!note.birp && !note.dap && !note.soap && (
            <p className="whitespace-pre-wrap text-sm">
              {note.content ?? "No content."}
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
