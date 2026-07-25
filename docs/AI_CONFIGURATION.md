# SBOS — Jessie AI Configuration

Jessie is SBOS's proprietary AI layer. It is provider-abstracted: every AI
capability runs on a real **offline default** and upgrades to a **hosted
provider** the moment a key is configured — no code changes.

## Provider selection

| Capability | Env key | Hosted provider | Offline default |
| --- | --- | --- | --- |
| Jessie chat | `OPENAI_API_KEY` | OpenAI-compatible LLM | deterministic heuristic |
| Note generation | (uses chat layer) | LLM | heuristic |
| Payments | `STRIPE_SECRET_KEY` | Stripe | manual (records) |
| Email | `RESEND_API_KEY` | Resend | console (logs) |
| SMS | Twilio trio | Twilio | console (logs) |

At boot the API logs which provider each capability selected, e.g.
`Jessie chat provider: LLM (gpt-4o-mini)` or `... offline heuristic`.

## Chat / LLM

```bash
OPENAI_API_KEY=sk-...
AI_BASE_URL=https://api.openai.com/v1   # or Azure / a local gateway
AI_MODEL=gpt-4o-mini
```

- Any **OpenAI-compatible** Chat Completions endpoint works (OpenAI, Azure
  OpenAI, self-hosted gateways). Point `AI_BASE_URL` at it.
- Grounding knowledge (published knowledge-base articles) is injected into the
  system prompt for the receptionist/knowledge/general assistants.
- Without a key, the offline heuristic assistant returns real, on-role replies —
  useful for demos and development, and never leaks PHI to a third party.

## Assistant kinds

Jessie routes each conversation to a specialized assistant:
`RECEPTIONIST`, `SCHEDULING`, `INTAKE`, `CLINICAL`, `KNOWLEDGE`, `GENERAL`.

## Prompt management

Each kind has a **default system prompt**; organizations can override it:

```bash
POST /api/v1/jessie/prompts { kind:"RECEPTIONIST", name:"Front desk", systemPrompt:"..." }
PATCH /api/v1/jessie/prompts/{id} { systemPrompt:"..." }   # bumps version
```

The active org prompt wins; otherwise the built-in default is used.

## Knowledge base

```bash
POST /api/v1/jessie/knowledge { title:"Office hours", body:"Mon–Fri 9–6", tags:["hours"] }
GET  /api/v1/jessie/knowledge?search=hours
```

Published articles ground grounded-kind answers.

## Conversation memory

Every message is persisted; the full history is replayed to the provider on each
turn, so conversations have memory. Retrieve a conversation with its messages:

```bash
GET /api/v1/jessie/conversations/{id}
```

## Payments (Stripe)

```bash
STRIPE_SECRET_KEY=sk_live_...
```

The Stripe adapter creates PaymentIntents server-side. Card collection/
confirmation is completed client-side with the returned intent (Stripe Elements)
in a production checkout flow. Without a key, the manual provider records
cash/check/external payments.

## Email & SMS

```bash
# Email (Resend)
RESEND_API_KEY=re_...
EMAIL_FROM=no-reply@yourdomain.com

# SMS (Twilio)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+15551234567
```

Wired uses: a welcome email on client creation and a confirmation SMS on
appointment creation (best-effort; no-op with console defaults).

## Security & compliance notes

- Sending PHI to a hosted LLM/email/SMS provider is a **business-associate**
  concern — execute BAAs and review data-handling before enabling providers in
  production with real patient data.
- Keys are read only from environment/secret storage, never persisted in the
  database or returned by the API.
- All AI actions are written to the audit trail.

## Independent licensing

Jessie is self-contained under `apps/api/src/ai/**` + `modules/jessie/**` behind
the `CHAT_PROVIDER` abstraction, so it can be extracted and licensed
independently of the rest of SBOS.
