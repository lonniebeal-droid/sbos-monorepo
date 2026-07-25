import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  SESSION_COOKIE,
} from "@/lib/auth";
import { apiV1 } from "@/lib/api";

const secure = process.env.NODE_ENV === "production";

export async function POST() {
  // Best-effort: revoke the refresh token server-side so it can't be reused.
  const refreshToken = (await cookies()).get(REFRESH_TOKEN_COOKIE)?.value;
  if (refreshToken) {
    try {
      await fetch(apiV1("/auth/logout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store",
      });
    } catch {
      // Ignore — cookies are cleared regardless.
    }
  }

  const response = NextResponse.json({ success: true });
  for (const name of [
    SESSION_COOKIE,
    ACCESS_TOKEN_COOKIE,
    REFRESH_TOKEN_COOKIE,
  ]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}
