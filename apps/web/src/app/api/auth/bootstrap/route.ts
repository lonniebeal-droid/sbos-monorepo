import { NextResponse } from 'next/server';
import { apiV1 } from '@/lib/api';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(apiV1('/auth/bootstrap'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Unable to reach the authentication service' }, { status: 503 });
  }
}
