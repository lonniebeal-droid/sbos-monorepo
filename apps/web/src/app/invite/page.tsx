"use client";
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function InvitePage() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('CLINICIAN');
  const [result, setResult] = useState<any>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    const res = await fetch('http://localhost:4000/api/v1/users/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, role }) });
    const data = await res.json().catch(() => ({}));
    setResult({ ok: res.ok, data });
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h2 className="text-2xl font-semibold mb-4">Invite User</h2>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label>Email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label>Role</Label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full p-2 border rounded">
            <option>CLINICIAN</option>
            <option>FRONT_DESK</option>
            <option>BILLING</option>
            <option>SUPERVISOR</option>
          </select>
        </div>
        <Button type="submit">Send Invite</Button>
      </form>
      {result && (
        <pre className="mt-4 p-2 bg-gray-100 rounded">{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  );
}
