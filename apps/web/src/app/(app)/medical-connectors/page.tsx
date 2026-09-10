import { Cable, ShieldCheck } from "lucide-react";
import { tryApiFetch } from "@/lib/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { ApiErrorBanner } from "@/components/dashboard/api-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectorWizard } from "@/components/medical-connectors/connector-wizard";
import { EdiStatusPanel } from "@/components/medical-connectors/edi-status-panel";

export const metadata = { title: "Medical Integrations" };

export interface VendorProfile { vendor: string; standard: string; authMode: string; suggestedScopes: string[]; }
export interface ConnectorRow { id: string; vendor: string; baseUrl: string; clientId: string | null; scopes: string | null; status: string; fhirVersion: string | null; lastTestedAt: string | null; lastError: string | null; }

export default async function MedicalConnectorsPage() {
  const [vendorsRes, connectorsRes] = await Promise.all([
    tryApiFetch<VendorProfile[]>("/medical-connectors/vendors"),
    tryApiFetch<ConnectorRow[]>("/medical-connectors"),
  ]);
  const vendors = vendorsRes.ok ? vendorsRes.data : [];
  const connectors = connectorsRes.ok ? connectorsRes.data : [];
  return <>
    <PageHeader title="Medical Integrations" description="ClaimFlow connector wizard and synthetic EDI readiness dashboard." />
    <Card className="border-amber-500/40 bg-amber-500/5"><CardHeader className="pb-3"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-amber-600"/><CardTitle className="text-base">Demo / synthetic data only</CardTitle><Badge variant="warning">NO REAL PHI</Badge></div><CardDescription>Use sandbox endpoints and fake test data only. Production PHI remains blocked until vendor registrations, BAAs, and compliance approvals are complete.</CardDescription></CardHeader></Card>
    {!vendorsRes.ok && <ApiErrorBanner message={vendorsRes.error} />}
    {!connectorsRes.ok && <ApiErrorBanner message={connectorsRes.error} />}
    <div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
      <ConnectorWizard vendors={vendors} connectors={connectors} disabled={!vendorsRes.ok || !connectorsRes.ok}/>
      <Card><CardHeader><div className="flex items-center gap-2"><Cable className="h-5 w-5"/><CardTitle>FHIR connection status</CardTitle></div><CardDescription>CapabilityStatement checks only. A successful capability check does not prove sandbox identity, OAuth authorization, or patient-data access.</CardDescription></CardHeader><CardContent className="space-y-3">{connectors.length === 0 ? <p className="text-sm text-muted-foreground">No connector configured yet.</p> : connectors.map(c => <div key={c.id} className="rounded-lg border p-3"><div className="flex items-center justify-between gap-2"><p className="font-medium">{c.vendor}</p><Badge variant={(c.status === "connected" || c.status === "sandbox_verified" || c.status === "capability_verified") ? "success" : c.status === "error" ? "destructive" : c.status === "testing" ? "warning" : "secondary"}>{c.status.replaceAll("_", " ")}</Badge></div><p className="mt-1 break-all text-xs text-muted-foreground">{c.baseUrl}</p><p className="mt-2 text-xs">FHIR: {c.fhirVersion ?? "not verified"}</p>{c.lastError && <p className="mt-1 text-xs text-destructive">{c.lastError}</p>}</div>)}</CardContent></Card>
    </div>
    <EdiStatusPanel />
  </>;
}
