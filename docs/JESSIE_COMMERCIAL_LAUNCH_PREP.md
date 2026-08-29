# Jessie Commercial Launch Prep

Last verified locally: 2026-08-29
Worktree: `/Users/lonniebgroupllc/download/sbos-agent4-commercial`
Branch: `docs/jessie-commercial-launch-prep`
HEAD: `fb4459fc19365dbf4a1b69ae21799dc1f082fb2a`

This checklist prepares the repo for future SBOS and Jessie commercialization.
It is documentation only. It does not enable payments, publish pricing, or
claim that a sellable hosted product is already live.

## Current product posture from the repo

- SBOS is framed as a release candidate with infrastructure, compliance, and
  provider activation still open.
- Jessie is described as independently licensable, but live LLM, voice, and
  workflow automation are not fully complete.
- Billing models exist in the app, yet real clearinghouse and broader launch
  infrastructure are still future work.

## Commercial packaging lanes

Three packaging lanes are implied by the current docs:

1. SBOS core behavioral-health platform
2. Jessie as an embedded SBOS assistant layer
3. Jessie as a future standalone licensable product

Do not present those three lanes as equally ready. The repo supports product
positioning and architecture claims better than hosted go-live claims.

## Pre-launch evidence required before external selling

- A verified staging environment with fresh smoke-test evidence
- Managed database, backup, and restore readiness
- Distinct production secret storage
- Logging, monitoring, and operational ownership
- Provider agreements and compliance review for any enabled subprocessors
- A clear statement of which Jessie capabilities are live, fallback-only, or
  roadmap

## Launch-safe messaging guardrails

- Say Jessie has assistant routing, memory, prompts, and knowledge grounding in
  the codebase today.
- Say hosted LLM, voice receptionist, workflow automation, and third-party
  provider activation are configuration-dependent or still in progress unless
  freshly proven otherwise.
- Do not claim live revenue processing unless a testable checkout flow has been
  verified in the target environment.
- Do not claim production healthcare compliance from local repo state alone.

## Commercial readiness checklist

- Define the exact offer: SBOS platform, Jessie add-on, or Jessie standalone.
- Freeze a supported feature list by environment: local, staging, production.
- Separate demo data, demo scripts, and demo credentials from any real client
  environment.
- Decide whether initial commercialization is services-led, tenant-by-tenant,
  or self-serve.
- Decide which adapters are part of launch day versus later upsells.
- Prepare support, rollback, incident-owner, and customer escalation paths.
- Prepare a launch FAQ that distinguishes built features from enabled features.

## Real-money and pricing guardrails

- Keep Stripe disabled until the hosted checkout path is verified end to end.
- Use test credentials only for pre-launch validation.
- Do not publish pricing promises that depend on voice, calendar, or workflow
  features that remain partial.
- Do not bind any external billing or payout account changes to this branch.

## Known blockers

- No hosted launch environment was verified in this session.
- No commercial checkout or subscription flow was verified.
- No production support process, on-call path, or customer contract artifact was
  inspected from this repo.
- No external pricing system or sales collateral was changed here.

## Recommended next safe action

Use staging verification as the commercialization gate. After staging is proven,
write a launch-facing feature matrix that splits `working now`, `working with
credentials`, and `roadmap`, then validate any real-money flow only in test mode
before external launch claims are made.
