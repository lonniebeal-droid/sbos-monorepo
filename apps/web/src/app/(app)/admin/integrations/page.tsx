import { HeartPulse } from "lucide-react";
import { tryApiFetch } from "@/lib/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { ApiErrorBanner } from "@/components/dashboard/api-state";
import { ProviderLifecyclePanel } from "@/components/admin/provider-lifecycle-panel";

export const metadata = { title: "Medical Provider Integrations" };

export interface ProviderHealth {
  status: "disconnected" | "connected" | "degraded" | "error";
  provider?: string;
  tenantId?: string;
  detail?: string;
  grantedScopes?: string[];
  lastSyncAt?: string | null;
  errorCount?: number;
}

export interface ProviderCapabilities {
  success: boolean;
  provider?: string;
  grantedScopes?: string[];
  supportedResources?: string[];
  health?: string;
  error?: string;
}

const PROVIDERS = [
  { id: "smart-fhir", label: "SMART on FHIR (R4 sandbox)" },
  { id: "epic", label: "Epic" },
  { id: "athenahealth", label: "athenahealth" },
  { id: "cerner", label: "Cerner (Oracle Health)" },
  { id: "eclinicalworks", label: "eClinicalWorks" },
  { id: "nextgen", label: "NextGen" },
  { id: "veradigm", label: "Veradigm" },
  { id: "simplepractice", label: "SimplePractice" },
  { id: "generichl7", label: "Generic HL7" },
];

const DEFAULT_SCOPES = ["patient/Patient.read", "patient/Appointment.read", "patient/Observation.read", "offline_access"];

export default async function AdminIntegrationsPage() {
  const [healthRes, capsRes] = await Promise.all([
    tryApiFetch<ProviderHealth>("/integrations/admin/medical-providers/health"),
    tryApiFetch<ProviderCapabilities>("/integrations/admin/medical-providers/capabilities"),
  ]);
  const health = healthRes.ok ? healthRes.data : null;
  const capabilities = capsRes.ok && capsRes.data.success ? capsRes.data : null;
  return (
    <>
      <PageHeader
        title="Medical Provider Integrations"
        description="Connect EHR and practice systems. Configure, authorize, test, sync, and manage the connection lifecycle."
      />
      {!healthRes.ok && <ApiErrorBanner message={healthRes.error} />}
      <ProviderLifecyclePanel
        health={health}
        capabilities={capabilities}
        providers={PROVIDERS}
        defaultScopes={DEFAULT_SCOPES}
        apiAvailable={healthRes.ok}
      />
      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <HeartPulse className="h-4 w-4" />
        Tenant-isolated: this connection belongs to your organization only. All lifecycle events are audited.
      </p>
    </>
  );
}
