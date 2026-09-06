import { NextRequest, NextResponse } from "next/server";
import {
  EPIC_CALLBACK_DEFAULT,
  EPIC_SANDBOX_FHIR_BASE,
  EPIC_SANDBOX_TOKEN,
} from "@/lib/epic-smart";

export const runtime = "nodejs";

function decodeJwtPayload(token?: string) {
  if (!token) return {} as Record<string, unknown>;
  try {
    const part = token.split(".")[1];
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error");
  if (error) return NextResponse.json({ ok: false, stage: "authorize", error }, { status: 400 });

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("sbos_epic_oauth_state")?.value;
  const verifier = request.cookies.get("sbos_epic_pkce")?.value;
  if (!code || !state || !expectedState || !verifier || state !== expectedState) {
    return NextResponse.json({ ok: false, stage: "callback", error: "Invalid or expired OAuth callback state" }, { status: 400 });
  }

  const clientId = process.env.EPIC_NON_PROD_CLIENT_ID;
  const clientSecret = process.env.EPIC_NON_PROD_CLIENT_SECRET;
  const redirectUri = process.env.EPIC_REDIRECT_URI ?? EPIC_CALLBACK_DEFAULT;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ ok: false, stage: "token", error: "Epic sandbox client credentials are not configured" }, { status: 503 });
  }

  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: verifier });
  const basic = Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString("base64");
  const tokenRes = await fetch(EPIC_SANDBOX_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` },
    body,
    cache: "no-store",
  });
  const tokenText = await tokenRes.text();
  let token: Record<string, unknown> = {};
  try { token = JSON.parse(tokenText) as Record<string, unknown>; } catch {}
  if (!tokenRes.ok) {
    return NextResponse.json({ ok: false, stage: "token", status: tokenRes.status, error: token.error ?? "Token exchange failed" }, { status: 502 });
  }

  const accessToken = typeof token.access_token === "string" ? token.access_token : undefined;
  const idPayload = decodeJwtPayload(typeof token.id_token === "string" ? token.id_token : undefined);
  const fhirUser = typeof idPayload.fhirUser === "string" ? idPayload.fhirUser : undefined;
  let fhirProbe: Record<string, unknown> = { attempted: false };

  if (accessToken && fhirUser && fhirUser.startsWith(EPIC_SANDBOX_FHIR_BASE)) {
    const probeRes = await fetch(fhirUser, {
      headers: { Accept: "application/fhir+json", Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const probeText = await probeRes.text();
    let resourceType: string | undefined;
    try { resourceType = (JSON.parse(probeText) as { resourceType?: string }).resourceType; } catch {}
    fhirProbe = { attempted: true, ok: probeRes.ok, status: probeRes.status, resourceType: resourceType ?? null };
  }

  const response = NextResponse.json({
    ok: true,
    stage: "complete",
    tokenReceived: Boolean(accessToken),
    tokenType: token.token_type ?? null,
    expiresIn: token.expires_in ?? null,
    grantedScope: token.scope ?? null,
    fhirProbe,
    note: "Synthetic Epic sandbox acceptance only. Access token and client secret were not persisted or returned.",
  });
  response.cookies.delete("sbos_epic_oauth_state");
  response.cookies.delete("sbos_epic_pkce");
  return response;
}
