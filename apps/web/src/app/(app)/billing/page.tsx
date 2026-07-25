import { DollarSign, FileText, Plus, Receipt } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
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

export const metadata = { title: "Billing" };

const claims = [
  { id: "CLM-4821", client: "Jordan Mitchell", payer: "Aetna", amount: "$180.00", status: "Paid" },
  { id: "CLM-4822", client: "Marcus Turner", payer: "BCBS", amount: "$150.00", status: "Submitted" },
  { id: "CLM-4823", client: "Elena Rodriguez", payer: "United", amount: "$180.00", status: "Denied" },
  { id: "CLM-4824", client: "Priya Shah", payer: "Cigna", amount: "$220.00", status: "Pending" },
];

const invoices = [
  { id: "INV-2051", client: "David Okafor", amount: "$120.00", due: "Jul 30", status: "Open" },
  { id: "INV-2052", client: "Sarah Lindqvist", amount: "$90.00", due: "Jul 28", status: "Overdue" },
  { id: "INV-2053", client: "Jordan Mitchell", amount: "$45.00", due: "Aug 2", status: "Paid" },
];

function claimVariant(status: string) {
  switch (status) {
    case "Paid":
      return "success" as const;
    case "Denied":
      return "destructive" as const;
    case "Pending":
      return "warning" as const;
    default:
      return "secondary" as const;
  }
}

export default function BillingPage() {
  return (
    <>
      <PageHeader
        title="Billing"
        description="Insurance claims, invoices, and payments."
        actions={
          <Button>
            <Plus className="h-4 w-4" /> Create claim
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Collected (MTD)" value="$42,180" icon={DollarSign} trend={{ value: "+12%", positive: true }} hint="vs. last month" />
        <StatCard label="Outstanding A/R" value="$18,420" icon={Receipt} hint="42 open claims" />
        <StatCard label="Denials" value="3" icon={FileText} hint="pending appeal" />
      </div>

      <Tabs defaultValue="claims">
        <TabsList>
          <TabsTrigger value="claims">Claims</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="claims">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Claim</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Payer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.map((claim) => (
                    <TableRow key={claim.id}>
                      <TableCell className="font-medium tabular-nums">{claim.id}</TableCell>
                      <TableCell>{claim.client}</TableCell>
                      <TableCell>{claim.payer}</TableCell>
                      <TableCell className="tabular-nums">{claim.amount}</TableCell>
                      <TableCell>
                        <Badge variant={claimVariant(claim.status)}>{claim.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium tabular-nums">{invoice.id}</TableCell>
                      <TableCell>{invoice.client}</TableCell>
                      <TableCell className="tabular-nums">{invoice.amount}</TableCell>
                      <TableCell className="text-muted-foreground">{invoice.due}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            invoice.status === "Paid"
                              ? "success"
                              : invoice.status === "Overdue"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {invoice.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
