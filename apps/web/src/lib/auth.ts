import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const encoder = new TextEncoder();

/**
 * Server-side auth secret. In production this is supplied via env; a stable
 * development fallback keeps local builds and previews working out of the box.
 */
function getSecret(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET ?? "sbos-development-secret-change-me-in-production";
  return encoder.encode(secret);
}

export const SESSION_COOKIE = "sbos_session";
/** API access/refresh tokens issued by the NestJS API, stored httpOnly. */
export const ACCESS_TOKEN_COOKIE = "sbos_at";
export const REFRESH_TOKEN_COOKIE = "sbos_rt";

export type UserRole =
  | "SUPER_ADMIN"
  | "ORG_ADMIN"
  | "CLINICIAN"
  | "SUPERVISOR"
  | "BILLING"
  | "FRONT_DESK";

export interface SessionUser extends JWTPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
}

export interface SessionClaims {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
}

export async function createSessionToken(user: SessionClaims): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.sub)
    .setIssuedAt()
    .setIssuer("sbos")
    .setExpirationTime("8h")
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: "sbos",
    });
    return payload as SessionUser;
  } catch {
    return null;
  }
}
