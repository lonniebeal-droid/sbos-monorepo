import { DollarSign, FileText, Receipt } from "lucide-react";

import { tryApiFetch, type Paginated } from "@/lib/api";
import { formatCurrency, fullName, titleCaseEnum } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { ApiErrorBanner } from "@/components/dashboard/api-state";
import { Button } from "@/components/ui/button";
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

export const metadata = { title: "Billing" };

interface ClaimRow {
  id: string;
  claimNumber: string;
  status: string;
  billedAmount: string;
  paidAmount: string;
  client: { firstName: string; lastName: string } | null;
}

interface Overview {
  collectedThisMonth: number;
  outstandingReceivables: number;
}

interface ClaimStatusRow {
  status: string;
  count: number;
  billed: number;
}

function claimVariant(status: string) {
  switch (status) {
    case "PAID":
      return "success" as const;
    case "DENIED":
    case "VOID":
      return "destructive" as const;
    case "DRAFT":
      return "secondary" as const;
    default:
      return "warning" as const;
  }
}

export default async function BillingPage() {
  const [claimsRes, overviewRes, byStatusRes] = await Promise.all([
    tryApiFetch<Paginated<ClaimRow>>("/billing/claims?limit=50"),
    tryApiFetch<Overview>("/analytics/overview"),
    tryApiFetch<ClaimStatusRow[]>("/analytics/claims-by-status"),
  ]);

  const claims = claimsRes.ok ? claimsRes.data.data : [];
  const overview = overviewRes.ok ? overviewRes.data : null;
  const denied = byStatusRes.ok
    ? (byStatusRes.data.find((r) => r.status === "DENIED")?.count ?? 0)
    : 0;
  const openClaims = claimsRes.ok ? claimsRes.data.meta.total : 0;

  return (
    <>
      <PageHeader
        title="Billing"
        description="Insurance claims, invoices, and payments."
        actions={<Button>Create claim</Button>}
      />

      {!claimsRes.ok && <ApiErrorBanner message={claimsRes.error} />}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Collected (MTD)"
          value={overview ? formatCurrency(overview.collectedThisMonth) : "—"}
          icon={DollarSign}
        />
        <StatCard
          label="Outstanding A/R"
          value={overview ? formatCurrency(overview.outstandingReceivables) : "—"}
          icon={Receipt}
          hint={`${openClaims} claim${openClaims === 1 ? "" : "s"}`}
        />
        <StatCard label="Denials" value={String(denied)} icon={FileText} />
      </div>

      <Card>
        <CardContent className="p-0">
          {claims.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No claims yet. Create a claim to begin billing.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Billed</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell className="font-medium tabular-nums">
                      {claim.claimNumber}
                    </TableCell>
                    <TableCell>
                      {claim.client ? fullName(claim.client) : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatCurrency(claim.billedAmount)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatCurrency(claim.paidAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={claimVariant(claim.status)}>
                        {titleCaseEnum(claim.status)}
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
