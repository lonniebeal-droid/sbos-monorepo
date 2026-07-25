import "server-only";

import type { NextResponse } from "next/server";

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  SESSION_COOKIE,
  createSessionToken,
  type UserRole,
} from "./auth";

export interface AuthedApiResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    organizationId: string;
  };
}

const secure = process.env.NODE_ENV === "production";
const base = {
  httpOnly: true,
  secure,
  sameSite: "lax" as const,
  path: "/",
};

/**
 * Set the web session cookie plus the API access/refresh tokens on a response.
 * Shared by the login and MFA-completion routes.
 */
export async function issueSessionCookies(
  response: NextResponse,
  data: AuthedApiResponse,
): Promise<void> {
  const sessionToken = await createSessionToken({
    sub: data.user.id,
    email: data.user.email,
    name: data.user.name,
    role: data.user.role,
    organizationId: data.user.organizationId,
  });

  response.cookies.set(SESSION_COOKIE, sessionToken, {
    ...base,
    maxAge: 60 * 60 * 8,
  });
  response.cookies.set(ACCESS_TOKEN_COOKIE, data.accessToken, {
    ...base,
    maxAge: 60 * 60 * 8,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, data.refreshToken, {
    ...base,
    maxAge: 60 * 60 * 24 * 7,
  });
}
