import "server-only";

import { cookies } from "next/headers";

import { SESSION_COOKIE, verifySessionToken, type SessionUser } from "./auth";

/**
 * Read and verify the current session on the server. Returns null when there is
 * no valid session cookie.
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
