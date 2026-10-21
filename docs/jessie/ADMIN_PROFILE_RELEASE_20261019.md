# Jessie tenant-profile release — 2026-10-19

Commit c569253; full API tests 457/457, TypeScript passed. Reproducible image sbos-api:jessie-admin-20261019 digest sha256:67fe9a62fa6337f82fab6780ee98370f61d7612d23abe82a651bfc80a59cd004.

Disposable staging: isolated PostgreSQL, 16 migrations, API 200, unauthenticated admin GET 401. Production backup: ~/.ju_secrets/backups/sbos-before-jessie-admin-20261019.dump (pg_restore archive verified); env backup: ~/.ju_secrets/backups/sbos-env-before-jessie-admin-20261019.

Production: new API image healthy, health 200, admin unauth 401, public tool unauth 401, 16 completed migrations, authenticated tenant lookup 200, bookingEnabled false. Protected .env pins docker-compose.jessie-admin-20261019.yml. No tenant profile activated.

Rollback: docker compose -f docker-compose.yml -f docker-compose.jessie-release.yml up -d --no-deps --no-build api; restore previous COMPOSE_FILE from protected backup. Do not delete production tables or volumes.

Unverified: ElevenLabs vendor tool registration, actual number assignment/intent routing, live transfers, CRM capture and scheduling. Appointment requests are not confirmed bookings.
