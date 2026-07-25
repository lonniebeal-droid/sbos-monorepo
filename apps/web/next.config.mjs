import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle for small, fast Docker images.
  output: "standalone",
  // Trace workspace dependencies from the monorepo root.
  outputFileTracingRoot: join(__dirname, "../../"),
  eslint: {
    // Linting is run as a separate workspace task; don't block production builds.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
