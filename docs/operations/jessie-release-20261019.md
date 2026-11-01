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

## Clean Dockerfile image promotion (later 2026-10-19)
An independent macOS launchd build completed the full `apps/api/Dockerfile` build successfully (persistent receipt `~/JU_COMMAND_CENTER/state/jessie-staging-build.status`, log `~/JU_COMMAND_CENTER/logs/jessie-staging-build.log`). New production candidate `sbos-api:jessie-release-20261019` has digest `sha256:c267ad59ebcddef738ba5157ea79cf5a0326e723bac5cd25ee2eebfdf346f074`. Shadow candidate against production DB passed health 200, unauthenticated Jessie 401, authenticated tenant lookup 200, and legacy agent tools 200. The initial patched image remains pinned as `sbos-api:rollback-patched-20261019` (digest e59b721...) and the original pre-Jessie image remains `sbos-api:rollback-20261019` (digest caa8143...). The release and rollback override files now target the clean and patched images, respectively. Use the rollback override if the clean release fails; it retains the Jessie route.
