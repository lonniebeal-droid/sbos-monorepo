import { FileText } from "lucide-react";

import { tryApiFetch, type Paginated } from "@/lib/api";
import { formatDate, fullName, titleCaseEnum } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/page-header";
import { ApiErrorBanner } from "@/components/dashboard/api-state";
import { NoteComposer } from "@/components/notes/note-composer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Clinical Notes" };

interface NoteRow {
  id: string;
  type: string;
  status: string;
  title: string | null;
  createdAt: string;
  client: { firstName: string; lastName: string } | null;
}

const noteTypes = [
  { key: "BIRP", name: "BIRP Note", desc: "Behavior · Intervention · Response · Plan" },
  { key: "DAP", name: "DAP Note", desc: "Data · Assessment · Plan" },
  { key: "SOAP", name: "SOAP Note", desc: "Subjective · Objective · Assessment · Plan" },
  { key: "GROUP", name: "Group Note", desc: "Shared group session documentation" },
];

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

export default async function NotesPage() {
  const res = await tryApiFetch<Paginated<NoteRow>>("/notes?limit=50");
  const notes = res.ok ? res.data.data : [];

  return (
    <>
      <PageHeader
        title="Clinical Notes"
        description="BIRP, DAP, SOAP, group notes, and treatment plans."
        actions={<NoteComposer />}
      />

      {!res.ok && <ApiErrorBanner message={res.error} />}

      <Tabs defaultValue="recent">
        <TabsList>
          <TabsTrigger value="recent">Recent notes</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="recent">
          <Card>
            <CardContent className="p-0">
              {notes.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  No notes yet. Create your first note to get started.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notes.map((note) => (
                      <TableRow key={note.id}>
                        <TableCell className="font-medium">
                          {note.client ? fullName(note.client) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{note.type}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(note.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(note.status)}>
                            {titleCaseEnum(note.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <div className="grid gap-4 sm:grid-cols-2">
            {noteTypes.map((type) => (
              <Card key={type.key}>
                <CardContent className="flex items-start gap-4 p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">{type.name}</p>
                    <p className="text-sm text-muted-foreground">{type.desc}</p>
                    <Button variant="link" className="h-auto p-0 text-sm">
                      Start note
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
