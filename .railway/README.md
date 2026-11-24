Railway Infrastructure as Code for SBOS.

- This repo uses Railway's current supported IaC path: `.railway/railway.ts`.
- Railway's older `railway.json` / `railway.toml` flow is deprecated for new services.
- The API service start command already runs `prisma:deploy`; do not add a second migration command in Railway for the same service, or one deploy will execute migrations twice.
- `NEXT_PUBLIC_API_URL` must point at the API's public HTTPS domain for browser-executed auth/setup flows.
- `SBOS_API_URL` should stay on the API's private Railway domain for server-side web requests.
