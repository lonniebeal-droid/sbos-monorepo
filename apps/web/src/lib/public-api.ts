/** Browser-safe API base URL for client-side fetches. */
export function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

export function publicApiV1(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${publicApiBaseUrl()}/api/v1${clean}`;
}
