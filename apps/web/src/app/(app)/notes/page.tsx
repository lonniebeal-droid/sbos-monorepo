import { FileText } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
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

const notes = [
  { client: "Jordan Mitchell", type: "BIRP", date: "Jul 22, 2026", clinician: "Dr. Chen", status: "Signed" },
  { client: "Priya Shah", type: "Intake", date: "Jul 22, 2026", clinician: "Dr. Chen", status: "Draft" },
  { client: "Marcus Turner", type: "DAP", date: "Jul 21, 2026", clinician: "Dr. Alvarez", status: "Awaiting co-sign" },
  { client: "DBT Skills Group", type: "Group", date: "Jul 21, 2026", clinician: "Dr. Patel", status: "Signed" },
  { client: "Elena Rodriguez", type: "SOAP", date: "Jul 20, 2026", clinician: "Dr. Chen", status: "Signed" },
];

const noteTypes = [
  { key: "BIRP", name: "BIRP Note", desc: "Behavior · Intervention · Response · Plan" },
  { key: "DAP", name: "DAP Note", desc: "Data · Assessment · Plan" },
  { key: "SOAP", name: "SOAP Note", desc: "Subjective · Objective · Assessment · Plan" },
  { key: "GROUP", name: "Group Note", desc: "Shared group session documentation" },
];

function statusVariant(status: string) {
  switch (status) {
    case "Signed":
      return "success" as const;
    case "Draft":
      return "secondary" as const;
    default:
      return "warning" as const;
  }
}

export default function NotesPage() {
  return (
    <>
      <PageHeader
        title="Clinical Notes"
        description="BIRP, DAP, SOAP, group notes, and treatment plans."
        actions={<NoteComposer />}
      />

      <Tabs defaultValue="recent">
        <TabsList>
          <TabsTrigger value="recent">Recent notes</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="recent">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Clinician</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notes.map((note, i) => (
                    <TableRow key={`${note.client}-${i}`}>
                      <TableCell className="font-medium">{note.client}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{note.type}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {note.date}
                      </TableCell>
                      <TableCell>{note.clinician}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(note.status)}>
                          {note.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
