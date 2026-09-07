import { createHash, randomBytes } from "node:crypto";

export const EPIC_SANDBOX_FHIR_BASE =
  "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4";
export const EPIC_SANDBOX_AUTHORIZE =
  "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize";
export const EPIC_SANDBOX_TOKEN =
  "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token";
export const EPIC_CALLBACK_DEFAULT =
  "https://sbos-web-production.up.railway.app/api/auth/callback/epic";
export const EPIC_DEFAULT_SCOPES = [
  "openid",
  "fhirUser",
  "user/Patient.read",
  "user/Encounter.read",
  "user/Condition.read",
  "user/Observation.read",
  "user/Practitioner.read",
].join(" ");

export function randomUrlSafe(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function oauthFormEncode(value: string) {
  return new URLSearchParams({ value }).toString().slice("value=".length);
}

export function epicClientBasicAuthorization(clientId: string, clientSecret: string) {
  const credentials = `${oauthFormEncode(clientId)}:${oauthFormEncode(clientSecret)}`;
  return `Basic ${Buffer.from(credentials, "utf8").toString("base64")}`;
}
