import { defineRailway, postgres, preserve, project, service } from "railway/iac";

export default defineRailway((ctx) => {
  const db = postgres("postgres");

  const api = service("api", {
    build: "pnpm turbo run build --filter=@sbos/core --filter=@sbos/database --filter=@sbos/api",
    // Migration runs here once per service start; do not also configure a Railway
    // pre-deploy migration command for this same service or the same deploy will execute it twice.
    start: "pnpm --filter @sbos/database prisma:deploy && node apps/api/dist/main.js",
    healthcheck: "/api/v1/health",
    healthcheckTimeout: 60,
    env: {
      DATABASE_URL: db.env.DATABASE_URL,
      NODE_ENV: "production",
      CORS_ORIGINS: preserve(),
      JWT_ACCESS_SECRET: preserve(),
      JWT_REFRESH_SECRET: preserve(),
      JESSIE_AGENT_SECRETS: preserve(),
      ADMIN_BOOTSTRAP_TOKEN: preserve(),
    },
  });

  const web = service("web", {
    build: "pnpm turbo run build --filter=@sbos/web",
    start: "pnpm --filter @sbos/web start",
    healthcheck: "/api/health",
    healthcheckTimeout: 60,
    env: {
      NODE_ENV: "production",
      SBOS_API_URL: `http://${api.env.RAILWAY_PRIVATE_DOMAIN}`,
      NEXT_PUBLIC_API_URL: `https://${api.env.RAILWAY_PUBLIC_DOMAIN}`,
      AUTH_SECRET: preserve(),
    },
  });

  return project("sbos-monorepo", {
    resources: [api, web, db],
  });
});
