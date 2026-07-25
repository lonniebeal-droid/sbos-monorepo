import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  SESSION_COOKIE,
  createSessionToken,
  type UserRole,
} from "@/lib/auth";
import { apiV1 } from "@/lib/api";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

interface ApiLoginResponse {
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

  // Web session cookie (source of truth for middleware/UI).
  const sessionToken = await createSessionToken({
    sub: data.user.id,
    email: data.user.email,
    name: data.user.name,
    role: data.user.role,
    organizationId: data.user.organizationId,
  });

  const response = NextResponse.json({ user: data.user });
  response.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
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

  return response;
}
