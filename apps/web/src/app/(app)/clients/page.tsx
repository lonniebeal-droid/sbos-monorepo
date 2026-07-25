import Link from "next/link";
import { AlertCircle, Users } from "lucide-react";

import { apiFetch, ApiError, type Paginated } from "@/lib/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { NewClientDialog } from "@/components/clients/new-client-dialog";
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

interface ClientRow {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  status: string;
  primaryClinician: {
    id: string;
    title: string | null;
    user: { firstName: string; lastName: string };
  } | null;
}

function statusVariant(status: string) {
  switch (status) {
    case "ACTIVE":
      return "success" as const;
    case "INTAKE":
    case "PROSPECT":
      return "default" as const;
    case "ON_HOLD":
      return "warning" as const;
    default:
      return "secondary" as const;
  }
}

function titleCase(status: string) {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function loadClients(): Promise<
  { clients: ClientRow[]; total: number } | { error: string }
> {
  try {
    const result = await apiFetch<Paginated<ClientRow>>("/clients?limit=50");
    return { clients: result.data, total: result.meta.total };
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.status === 503
          ? "The SBOS API is not reachable. Start the API to see live clients."
          : error.message
        : "Failed to load clients.";
    return { error: message };
  }
}

export default async function ClientsPage() {
  const result = await loadClients();
  const hasError = "error" in result;
  const clients = hasError ? [] : result.clients;

  return (
    <>
      <PageHeader
        title="Clients"
        description="Manage your client roster, charts, and admissions."
        actions={<NewClientDialog />}
      />

      {hasError && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {result.error}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Users className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No clients yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {hasError
                  ? "Once the API and database are connected, your client roster will appear here."
                  : "Add your first client to get started."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>MRN</TableHead>
                  <TableHead>Primary clinician</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/clients/${client.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {client.firstName} {client.lastName}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {client.mrn}
                    </TableCell>
                    <TableCell>
                      {client.primaryClinician
                        ? `${client.primaryClinician.title ?? ""} ${client.primaryClinician.user.firstName} ${client.primaryClinician.user.lastName}`.trim()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(client.status)}>
                        {titleCase(client.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
