# Jessie Staging Integration Prep

Last verified locally: 2026-08-29
Worktree: `/Users/lonniebgroupllc/download/sbos-agent3-jessie`
Branch: `docs/jessie-staging-integration-prep`
HEAD: `fb4459fc19365dbf4a1b69ae21799dc1f082fb2a`

This document turns the repo's existing Jessie documentation into a staging-prep
checklist. It does not claim any live provider account, hosted environment, or
external integration is already working.

## Repo evidence checked

- Jessie module wiring exists in `apps/api/src/modules/jessie/**`.
- Jessie provider configuration is documented in `docs/AI_CONFIGURATION.md`.
- The project roadmap marks Jessie assistants, prompts, memory, and knowledge
  base as built, while live LLM, voice, and workflow automation remain partial
  or future work in `PROJECT_MASTER_PLAN.md`.

## What Jessie is ready to stage locally

- Conversation creation and message persistence
- Assistant routing by kind
- Prompt overrides
- Knowledge-base publishing and retrieval
- Offline heuristic replies when no LLM key is configured

These are the safest staging targets because they do not require live provider
credentials to validate the control flow.

## Staging integration decisions to make before boot

### AI provider mode

Choose one of two modes explicitly:

1. Offline-only Jessie staging
2. Hosted LLM staging through an OpenAI-compatible endpoint

Offline-only staging is safer for first boot because it avoids secret handling
and BAA questions while still exercising the Jessie routes end to end.

### Non-AI adapters

Decide separately whether staging should keep these in fallback mode or use test
credentials:

- Stripe
- Resend
- Twilio

If test credentials are unavailable, leave them disabled and verify fallback
behavior only.

## Required environment for Jessie staging

Minimum Jessie-capable staging:

- `NODE_ENV=production`
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `AUTH_SECRET`
- `SBOS_API_URL`
- `CORS_ORIGINS`

Only for hosted Jessie chat:

- `OPENAI_API_KEY`
- `AI_BASE_URL`
- `AI_MODEL`

Only for adapter validation:

- `STRIPE_SECRET_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

## Safe staging validation sequence

1. Boot staging with Jessie in offline mode first.
2. Verify API startup logs show the selected Jessie provider mode.
3. Create a Jessie conversation for each supported assistant kind.
4. Send one message per assistant kind and verify persistence plus response.
5. Add an organization prompt override and verify it wins over the default.
6. Publish a knowledge article and verify a grounded answer path uses it.
7. Only after offline validation passes, decide whether hosted LLM mode is
   worth enabling in staging.

## Explicitly out of scope for this prep branch

- Voice receptionist rollout
- Live telephony routing
- Calendar sync
- Workflow automation claims
- Production BAA/compliance signoff
- Any live account changes in OpenAI, Twilio, Stripe, Resend, or ElevenLabs

## Known blockers

- No staging environment or hosted logs were inspected in this session.
- No provider credentials were verified.
- No live voice or phone-routing implementation was validated from this repo.
- Any hosted LLM use with real PHI remains blocked on compliance review and
  subprocessor agreements.

## Recommended next safe action

Stage Jessie in offline mode first and prove the module routes, persistence,
prompts, and knowledge grounding with fresh HTTP and log evidence. Treat hosted
LLM, SMS, email, payments, and voice as separate opt-in validations after the
offline path is green.
