"use client";
import { useState, useTransition } from "react";
import { Loader2, PlugZap, Unplug } from "lucide-react";
import { toast } from "sonner";
import { disconnectMedicalConnectorAction, saveMedicalConnectorAction, testMedicalConnectorAction } from "@/lib/actions";
import type { ConnectorRow, VendorProfile } from "@/app/(app)/medical-connectors/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ConnectorWizard({ vendors, connectors, disabled }: { vendors: VendorProfile[]; connectors: ConnectorRow[]; disabled?: boolean }) {
  const [vendor, setVendor] = useState(vendors[0]?.vendor ?? "Epic");
  const profile = vendors.find(v => v.vendor === vendor);
  const existing = connectors.find(c => c.vendor === vendor);
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? "");
  const [clientId, setClientId] = useState(existing?.clientId ?? "");
  const [scopes, setScopes] = useState(existing?.scopes ?? profile?.suggestedScopes.join(" ") ?? "");
  const [pending, startTransition] = useTransition();
  function changeVendor(next: string) { const c=connectors.find(x=>x.vendor===next); const p=vendors.find(x=>x.vendor===next); setVendor(next); setBaseUrl(c?.baseUrl ?? ""); setClientId(c?.clientId ?? ""); setScopes(c?.scopes ?? p?.suggestedScopes.join(" ") ?? ""); }
  function save() { startTransition(async()=>{ const r=await saveMedicalConnectorAction({vendor,baseUrl,clientId:clientId||undefined,scopes:scopes||undefined}); r.ok ? toast.success("Connector configuration saved") : toast.error(r.error); if(r.ok) location.reload(); }); }
  function test() { if(!existing) return toast.error("Save the connector first"); startTransition(async()=>{ const r=await testMedicalConnectorAction(existing.id); r.ok ? toast.success(String(r.data?.message ?? "FHIR connection test completed")) : toast.error(r.error); location.reload(); }); }
  function disconnect() { if(!existing) return; startTransition(async()=>{ const r=await disconnectMedicalConnectorAction(existing.id); r.ok ? toast.success("Connector disconnected") : toast.error(r.error); location.reload(); }); }
  return <Card><CardHeader><div className="flex items-center gap-2"><PlugZap className="h-5 w-5"/><CardTitle>Connector Wizard</CardTitle></div><CardDescription>Configure a standards-first EHR connection using SMART on FHIR R4. Test only checks the FHIR capability endpoint.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label htmlFor="vendor">EHR vendor</Label><select id="vendor" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={vendor} onChange={e=>changeVendor(e.target.value)} disabled={disabled||pending}>{vendors.map(v=><option key={v.vendor}>{v.vendor}</option>)}</select></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="base">FHIR R4 base URL</Label><Input id="base" value={baseUrl} onChange={e=>setBaseUrl(e.target.value)} placeholder="https://sandbox.example.com/FHIR/R4" disabled={disabled||pending}/></div><div className="space-y-2"><Label htmlFor="client">OAuth client ID</Label><Input id="client" value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="Sandbox client ID" disabled={disabled||pending}/></div></div><div className="space-y-2"><Label htmlFor="scopes">Least-privilege scopes</Label><Input id="scopes" value={scopes} onChange={e=>setScopes(e.target.value)} disabled={disabled||pending}/></div><div className="flex flex-wrap gap-2 text-xs"><Badge variant="outline">{profile?.standard ?? "FHIR R4"}</Badge><Badge variant="outline">{profile?.authMode ?? "SMART on FHIR"}</Badge>{existing && <Badge variant={(existing.status === "connected" || existing.status === "sandbox_verified") ? "success" : existing.status === "error" ? "destructive" : "secondary"}>{existing.status.replaceAll("_"," ")}</Badge>}</div></CardContent><CardFooter className="flex flex-wrap gap-2"><Button onClick={save} disabled={disabled||pending||!baseUrl}>{pending&&<Loader2 className="h-4 w-4 animate-spin"/>}Save configuration</Button><Button variant="outline" onClick={test} disabled={disabled||pending||!existing}>Test connection</Button><Button variant="outline" onClick={disconnect} disabled={disabled||pending||!existing}><Unplug className="h-4 w-4"/>Disconnect</Button></CardFooter></Card>;
}
