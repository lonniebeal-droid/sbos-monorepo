import { Plus, Search } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Clients" };

const clients = [
  { name: "Jordan Mitchell", mrn: "SB-10241", clinician: "Dr. Chen", status: "Active", next: "Jul 24, 9:00 AM" },
  { name: "Priya Shah", mrn: "SB-10242", clinician: "Dr. Chen", status: "Intake", next: "Jul 24, 10:00 AM" },
  { name: "Marcus Turner", mrn: "SB-10243", clinician: "Dr. Alvarez", status: "Active", next: "Jul 24, 11:30 AM" },
  { name: "Elena Rodriguez", mrn: "SB-10244", clinician: "Dr. Chen", status: "Active", next: "Jul 24, 3:00 PM" },
  { name: "David Okafor", mrn: "SB-10245", clinician: "Dr. Patel", status: "On hold", next: "—" },
  { name: "Sarah Lindqvist", mrn: "SB-10246", clinician: "Dr. Alvarez", status: "Discharged", next: "—" },
];

function statusVariant(status: string) {
  switch (status) {
    case "Active":
      return "success" as const;
    case "Intake":
      return "default" as const;
    case "On hold":
      return "warning" as const;
    default:
      return "secondary" as const;
  }
}

export default function ClientsPage() {
  return (
    <>
      <PageHeader
        title="Clients"
        description="Manage your client roster, charts, and admissions."
        actions={
          <Button>
            <Plus className="h-4 w-4" /> Add client
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b p-4">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by name or MRN…" className="pl-9" />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>MRN</TableHead>
                <TableHead>Primary clinician</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Next appointment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.mrn}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {client.mrn}
                  </TableCell>
                  <TableCell>{client.clinician}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(client.status)}>
                      {client.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {client.next}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
