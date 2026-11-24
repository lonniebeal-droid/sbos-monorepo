# PR #12 focused repair — 2026-11-04

## Scope

Original PR #12 (`test/jessie-staging-e2e`) is 84 commits behind the then-current
`main` and has six direct merge conflicts. Its earlier service/controller/schema
versions overlap with newer implementation already on `main`. The original PR is
**not safe to merge wholesale**. This replacement is a new branch from main,
with only the E2E fixture/mocks/harness carried forward and adapted to the newer
atomic Prisma transaction implementation. All original PR #12 history is retained.

## Changes

- Port Jessie synthetic HTTP harness, fixtures and mock Make receiver from PR #12.
- Update mocked Prisma to implement `$transaction` and `idempotencyKey.update`.
- Make appointment creation mocks return persisted status from their `data` payload,
  rather than fabricating a `SCHEDULED` status for confirmed bookings.
- Add `@Public()` to the legacy Jessie service-secret controller so the global JWT
  guard cannot reject its server-to-server credentials. `@UseGuards(JessieAuthGuard)`
  remains in place. Add a regression test for both metadata requirements.
- Add only pinned Nest test/supertest development dependencies and lockfile updates.

## Verified local checks (Mac, isolated worktree)

- Fresh main base: `d8dfd34`; preserved dirty `~/sbos-monorepo` untouched.
- Full `apps/api` Vitest suite: **725 pass, 5 skipped, zero failures**, 82 files.
- Focused migrated Jessie harness + service-auth metadata: **138/138 pass**.
- `tsc --noEmit`: **zero errors**.
- `nest build`: **success**.
- `git diff --check`: clean before commit.
- Dependencies installed into isolated pnpm cache because old default store points
  to disconnected `/Volumes/SpaceDrive`.

## Production gate / known P1

GitHub issue #57 documents a current-main appointment scheduling defect: when an
unavailable slot is requested, Jessie can persist a calendar-counted `SCHEDULED`
appointment even while returning `REQUESTED`; it also does not consistently
consult clinician availability and time-off before instant confirmation.

**Do not merge or deploy the draft replacement PR** until issue #57 has a
verified separate fix or the product owner has explicitly resolved the safety
boundary. These tests are synthetic and do not resolve that defect.

No secrets, production DB writes, human appointments, paid services, or external
provider calls were used. Spend: $0.
