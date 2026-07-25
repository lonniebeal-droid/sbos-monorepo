import { decodeJwt } from "jose";
import { NextRequest, NextResponse } from "next/server";

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout"];

const secure = process.env.NODE_ENV === "production";

function isExpired(token: string | undefined): boolean {
  if (!token) return true;
  try {
    const { exp } = decodeJwt(token);
    if (!exp) return true;
    // Refresh a minute early to avoid races on in-flight requests.
    return exp * 1000 < Date.now() + 60_000;
  } catch {
    return true;
  }
}

async function refreshAccessToken(
  request: NextRequest,
  response: NextResponse,
): Promise<void> {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) return;

  const base =
    process.env.SBOS_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000";

  try {
    const res = await fetch(`${base}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      accessToken: string;
      refreshToken: string;
    };
    response.cookies.set(ACCESS_TOKEN_COOKIE, data.accessToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    response.cookies.set(REFRESH_TOKEN_COOKIE, data.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  } catch {
    // Best-effort: if refresh fails, the next protected read will surface it.
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isPublic) {
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  // Keep the API access token fresh for server-side data fetching.
  if (isExpired(request.cookies.get(ACCESS_TOKEN_COOKIE)?.value)) {
    await refreshAccessToken(request, response);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
