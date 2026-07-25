import { NextResponse } from "next/server";
import { z } from "zod";

import type { UserRole } from "@/lib/auth";
import { apiV1 } from "@/lib/api";
import { issueSessionCookies } from "@/lib/set-auth-cookies";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

interface ApiLoginResponse {
  accessToken?: string;
  refreshToken?: string;
  mfaRequired?: boolean;
  mfaToken?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    organizationId: string;
  };
}

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email and password" },
      { status: 400 },
    );
  }

  // Authenticate against the SBOS API.
  let apiResponse: Response;
  try {
    apiResponse = await fetch(apiV1("/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to reach the authentication service" },
      { status: 503 },
    );
  }

  if (!apiResponse.ok) {
    const status = apiResponse.status === 401 ? 401 : 400;
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status },
    );
  }

  const data = (await apiResponse.json()) as ApiLoginResponse;

  // MFA-enabled account: relay the challenge; the client completes it at
  // /api/auth/mfa. No cookies are set yet.
  if (data.mfaRequired && data.mfaToken) {
    return NextResponse.json({
      mfaRequired: true,
      mfaToken: data.mfaToken,
    });
  }

  if (!data.accessToken || !data.refreshToken || !data.user) {
    return NextResponse.json(
      { error: "Unexpected authentication response" },
      { status: 502 },
    );
  }

  const response = NextResponse.json({ user: data.user });
  await issueSessionCookies(response, {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
  });
  return response;
}
