# Jessie API release — 2026-10-19

Live API deployed and acceptance passed. This does NOT prove public HTTPS or actual phone-call integration.

- Branch: `ju/recovery-readiness-20261019`; prior source HEAD `8f1f68a`.
- Release image `sbos-api:jessie-20261019`, digest `sha256:e59b7218463f490ae4b82d60c57f6c2f86ae45cf8521dfb8fc2a00d43a57ac26`.
- Rollback image `sbos-api:rollback-20261019`, digest `sha256:caa8143d11d91d0db676b9e5d6bf714736febe44aa38d1d994abf6fa3d8caa73`.
- Image built by layering compiled `apps/api/dist` on previous image; NOT a reproducible full Dockerfile build.
- Production `.env` mode 600; `JESSIE_AGENT_SECRETS` mapped from existing authorized org and legacy tool secret. Values never committed. Protected backup at `~/.ju_secrets/backups/sbos-env-before-jessie-20261019`.
- `.env` COMPOSE_FILE pins the release override for future `docker compose` commands.
- Acceptance: 451 tests, TypeScript compile, Prisma 15 migrations current; live API health 200; Jessie unauth 401 (previously 404); authorized business lookup 200; legacy agent-tools authenticated health 200; Postgres and Redis healthy.

Rollback: from repo run `docker compose -f docker-compose.yml -f docker-compose.jessie-rollback.yml up -d --no-deps --no-build api`, then verify health 200. For persistent rollback also change `.env` COMPOSE_FILE to the rollback override. Do not remove volumes or reset Git.

Open: bookingEnabled=false on new lookup; no verified public HTTPS, webhook, actual calls, two-call memory, transfers or scheduling acceptance. New header `x-sbos-agent-secret`; legacy header `x-ju-agent-tools-secret`. Dedicated key rotation and clean image build remain follow-ups. Web container not running at this checkpoint.
