import { proxyJsonPost } from "@/lib/api-proxy";

export async function POST(request: Request) {
  return proxyJsonPost(request, "/auth/invite/accept", { auth: false });
}
