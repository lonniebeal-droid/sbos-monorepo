"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function FirstAdmin() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [token, setToken] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:4000/api/v1/auth/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, organizationName: orgName, organizationSlug: orgSlug, adminEmail: email, adminPassword: password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Bootstrap failed');
        return;
      }
      router.push('/login');
    } catch (err) {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h2 className="text-2xl font-semibold mb-4">Initial Admin Setup</h2>
      <p className="mb-4 text-sm text-muted-foreground">If this installation has no admins, create the first organization and admin. You must provide the bootstrap token from the environment to proceed.</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label>Bootstrap Token</Label>
          <Input value={token} onChange={(e) => setToken(e.target.value)} />
        </div>
        <div>
          <Label>Organization Name</Label>
          <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
        </div>
        <div>
          <Label>Organization Slug</Label>
          <Input value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)} />
        </div>
        <div>
          <Label>Admin Email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label>Admin Password</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={submitting}>
          Create Admin
        </Button>
      </form>
    </div>
  );
}
