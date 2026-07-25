import "server-only";

import { cookies } from "next/headers";

import { ACCESS_TOKEN_COOKIE } from "./auth";

/** Base URL of the SBOS REST API (without the /api/v1 suffix). */
export function apiBaseUrl(): string {
  return (
    process.env.SBOS_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000"
  );
}

export function apiV1(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${apiBaseUrl()}/api/v1${clean}`;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiFetchOptions extends RequestInit {
  /** When false, don't attach the bearer token (public endpoints). */
  auth?: boolean;
}

/**
 * Server-side fetch to the SBOS API. Attaches the caller's API access token
 * (from the httpOnly cookie set at login) and normalizes errors. The access
 * token is kept fresh by middleware, so reads here generally succeed while the
 * session is valid.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { auth = true, headers, ...rest } = options;
  const finalHeaders = new Headers(headers);
  finalHeaders.set("Content-Type", "application/json");

  if (auth) {
    const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
    if (token) finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(apiV1(path), {
      ...rest,
      headers: finalHeaders,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(503, "The SBOS API is unreachable");
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : (body.message ?? response.statusText);
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
