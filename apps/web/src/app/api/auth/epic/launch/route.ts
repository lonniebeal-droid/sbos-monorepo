import { NextResponse } from "next/server";
import {
  EPIC_CALLBACK_DEFAULT,
  EPIC_DEFAULT_SCOPES,
  EPIC_SANDBOX_AUTHORIZE,
  EPIC_SANDBOX_FHIR_BASE,
  pkceChallenge,
  randomUrlSafe,
} from "@/lib/epic-smart";

export const runtime = "nodejs";

export async function GET() {
  const clientId = process.env.EPIC_NON_PROD_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ ok: false, error: "EPIC_NON_PROD_CLIENT_ID is not configured" }, { status: 503 });
  }

  const redirectUri = process.env.EPIC_REDIRECT_URI ?? EPIC_CALLBACK_DEFAULT;
  const state = randomUrlSafe(32);
  const verifier = randomUrlSafe(64);
  const url = new URL(EPIC_SANDBOX_AUTHORIZE);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", process.env.EPIC_SMART_SCOPES ?? EPIC_DEFAULT_SCOPES);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", pkceChallenge(verifier));
  url.searchParams.set("aud", EPIC_SANDBOX_FHIR_BASE);

  const response = NextResponse.redirect(url);
  const cookie = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 600 };
  response.cookies.set("sbos_epic_oauth_state", state, cookie);
  response.cookies.set("sbos_epic_pkce", verifier, cookie);
  return response;
}
