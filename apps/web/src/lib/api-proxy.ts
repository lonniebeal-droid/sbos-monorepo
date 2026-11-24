import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { apiV1 } from "./api";
import { ACCESS_TOKEN_COOKIE } from "./auth";

/**
 * Forward a JSON POST from the browser to the SBOS API, server-side.
 * Browser code must never call the API host directly (it is not reachable
 * from users' machines and would bypass the httpOnly session cookies).
 */
export async function proxyJsonPost(
  request: Request,
  path: string,
  { auth }: { auth: boolean },
): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const headers = new Headers({ "Content-Type": "application/json" });
  if (auth) {
    const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }
    headers.set("Authorization", `Bearer ${token}`);
  }

  let upstream: Response;
  try {
    upstream = await fetch(apiV1(path), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { message: "The SBOS API is unreachable" },
      { status: 503 },
    );
  }

  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
