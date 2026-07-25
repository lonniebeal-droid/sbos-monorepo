import { NextResponse } from "next/server";

/** Liveness probe for load balancers and container health checks. */
export function GET() {
  return NextResponse.json({ status: "ok", service: "sbos-web" });
}
