"use client";
import { useState, useTransition } from "react";
import { Activity, CheckCircle2, Loader2, PlugZap, RefreshCw, ShieldCheck, Unplug, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  authorizeMedicalProviderAction,
  configureMedicalProviderAction,
  retryMedicalProviderAction,
  revokeMedicalProviderAction,
  syncMedicalProviderAction,
  testMedicalProviderAction,
} from "@/lib/actions";
import type { ProviderCapabilities, ProviderHealth } from "@/app/(app)/admin/integrations/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  health: ProviderHealth | null;
  capabilities: ProviderCapabilities | null;
  providers: { id: string; label: string }[];
  defaultScopes: string[];
  apiAvailable: boolean;
}

function statusBadge(status: string) {
  if (status === "connected") return <Badge variant="success">Connected</Badge>;
  if (status === "degraded") return <Badge variant="warning">Degraded</Badge>;
  if (status === "error") return <Badge variant="destructive">Error</Badge>;
  return <Badge variant="secondary">Disconnected</Badge>;
}

export function ProviderLifecyclePanel({ health, capabilities, providers, defaultScopes, apiAvailable }: Props) {
  const [pending, startTransition] = useTransition();
  const [provider, setProvider] = useState(providers[0]?.id ?? "smart-fhir");
  const [baseUrl, setBaseUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [scopes, setScopes] = useState(defaultScopes.join(" "));
  const [authCode, setAuthCode] = useState("");
  const [resourceTypes, setResourceTypes] = useState("Patient, Appointment, Observation");

  const isConfigured = health !== null && health.status !== "disconnected";
  const hasError = health?.status === "error" || health?.status === "degraded";

  function run(label: string, fn: () => Promise<{ ok: boolean; error?: string; data?: Record<string, unknown> }>) {
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(label);
        location.reload();
      } else {
        toast.error(r.error || label + " failed");
      }
    });
  }

  const doConfigure = () =>
    run("Provider configured", () =>
      configureMedicalProviderAction({
        provider,
        baseUrl,
        clientId,
        scopes: scopes.split(/[\s,]+/).filter(Boolean),
      }),
    );
  const doAuthorize = () => run("Authorization attempted", () => authorizeMedicalProviderAction(authCode || undefined));
  const doTest = () => run("Connection test completed", testMedicalProviderAction);
  const doSync = () =>
    run("Sync completed", () => syncMedicalProviderAction(resourceTypes.split(/[\s,]+/).filter(Boolean)));
  const doRetry = () => run("Retry attempted", retryMedicalProviderAction);
  const doRevoke = () => {
    if (!confirm("Revoke this medical provider connection? This cannot be undone.")) return;
    startTransition(async () => {
      const r = await revokeMedicalProviderAction();
      r.ok ? (toast.success("Connection revoked"), location.reload()) : toast.error(r.error);
    });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <PlugZap className="h-5 w-5" />
            <CardTitle>Connection</CardTitle>
          </div>
          <CardDescription>
            {isConfigured
              ? "A provider is configured for your organization. Manage its lifecycle below."
              : "Select a provider and configure the connection. Authorization follows configuration."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium">Status</span>
            {statusBadge(health?.status ?? "disconnected")}
          </div>
          {health?.detail && <p className="text-sm text-muted-foreground">{health.detail}</p>}
          {health?.errorCount != null && health.errorCount > 0 && (
            <p className="flex items-center gap-2 text-sm text-amber-600">
              <XCircle className="h-4 w-4" /> {health.errorCount} recorded error(s)
            </p>
          )}

          {!isConfigured && (
            <>
              <div className="space-y-2">
                <Label htmlFor="provider">EHR / practice system</Label>
                <select
                  id="provider"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  disabled={pending || !apiAvailable}
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="baseUrl">Base URL</Label>
                  <Input
                    id="baseUrl"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://fhir.sandbox.example.com/R4"
                    disabled={pending || !apiAvailable}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientId">Client ID</Label>
                  <Input
                    id="clientId"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="OAuth client identifier"
                    disabled={pending || !apiAvailable}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="scopes">Scopes (least privilege)</Label>
                <Input
                  id="scopes"
                  value={scopes}
                  onChange={(e) => setScopes(e.target.value)}
                  disabled={pending || !apiAvailable}
                />
                <p className="text-xs text-muted-foreground">Space or comma separated. Only the minimum scopes needed.</p>
              </div>
            </>
          )}

          {isConfigured && (
            <div className="space-y-2">
              <Label htmlFor="authCode">OAuth authorization code (if required)</Label>
              <Input
                id="authCode"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                placeholder="Paste code from provider, or leave blank"
                disabled={pending || !apiAvailable}
              />
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          {!isConfigured && (
            <Button onClick={doConfigure} disabled={pending || !apiAvailable || !baseUrl || !clientId}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Configure provider
            </Button>
          )}
          {isConfigured && (
            <>
              <Button onClick={doAuthorize} disabled={pending || !apiAvailable}>
                Authorize
              </Button>
              <Button variant="outline" onClick={doTest} disabled={pending || !apiAvailable}>
                <Activity className="h-4 w-4" /> Test connection
              </Button>
              {hasError && (
                <Button variant="outline" onClick={doRetry} disabled={pending || !apiAvailable}>
                  <RefreshCw className="h-4 w-4" /> Retry
                </Button>
              )}
              <Button variant="outline" onClick={doRevoke} disabled={pending || !apiAvailable}>
                <Unplug className="h-4 w-4" /> Revoke
              </Button>
            </>
          )}
        </CardFooter>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              <CardTitle>Capabilities</CardTitle>
            </div>
            <CardDescription>Granted scopes and supported resources for this connection.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!capabilities ? (
              <p className="text-sm text-muted-foreground">No provider configured — capabilities unavailable.</p>
            ) : (
              <>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Provider</p>
                  <p className="text-sm">{capabilities.provider ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Granted scopes</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(capabilities.grantedScopes ?? []).map((s) => (
                      <Badge key={s} variant="outline">{s}</Badge>
                    ))}
                    {(capabilities.grantedScopes ?? []).length === 0 && (
                      <span className="text-sm text-muted-foreground">None</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Supported resources</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(capabilities.supportedResources ?? []).map((r) => (
                      <Badge key={r} variant="secondary">{r}</Badge>
                    ))}
                    {(capabilities.supportedResources ?? []).length === 0 && (
                      <span className="text-sm text-muted-foreground">None discovered</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              <CardTitle>Sync</CardTitle>
            </div>
            <CardDescription>Sync permitted synthetic FHIR resources from the connected provider.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="resources">Resource types</Label>
            <Input
              id="resources"
              value={resourceTypes}
              onChange={(e) => setResourceTypes(e.target.value)}
              placeholder="Patient, Appointment, Observation"
              disabled={pending || !apiAvailable || !isConfigured}
            />
          </CardContent>
          <CardFooter>
            <Button onClick={doSync} disabled={pending || !apiAvailable || !isConfigured}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Sync resources
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
