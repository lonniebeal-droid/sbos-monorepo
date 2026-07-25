import { NextResponse } from "next/server";
import { z } from "zod";

import { apiV1 } from "@/lib/api";
import {
  issueSessionCookies,
  type AuthedApiResponse,
} from "@/lib/set-auth-cookies";

const mfaSchema = z.object({
  mfaToken: z.string().min(1),
  code: z.string().length(6),
});

/** Completes an MFA login: verifies the code with the API and sets cookies. */
export async function POST(request: Request) {
  const parsed = mfaSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter the 6-digit code" },
      { status: 400 },
    );
  }

  let apiResponse: Response;
  try {
    apiResponse = await fetch(apiV1("/auth/login/mfa"), {
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
    return NextResponse.json(
      { error: "Invalid or expired code" },
      { status: 401 },
    );
  }

  const data = (await apiResponse.json()) as AuthedApiResponse;
  const response = NextResponse.json({ user: data.user });
  await issueSessionCookies(response, data);
  return response;
}
