# Jessie live integration — 2026-10-19

Use `elevenlabs-integration-live-tools.json` for the currently mounted SBOS API. The older `elevenlabs-webhook-tools.json` references a controller that is NOT mounted in the current production image; do not use its URLs.

HTTPS base: `https://lonnies-macbook-air.tail11453f.ts.net:8443/api/v1/jessie/integration`. Tailscale Funnel forwards to a Mac relay with a strict seven-route allowlist and then to the authenticated local SBOS API. The original `/pre-call` and `/post-call` webhook paths remain operational.

Each tool is POST with `Content-Type: application/json` and `x-sbos-agent-secret` set to the authorized organization secret. No secrets are in the JSON manifest. Vendor-side registration of the seven tools is NOT verified.

The new lookup currently returns `bookingEnabled: false`. An appointment request is NOT a confirmed booking. Do not promise booking until calendar and appointment acceptance pass. Phone number assignments and intent-based transfers also remain unverified.

Tests: API health 200; local relay authenticated lookup 200; public missing-secret 401; six other routes reject invalid DTOs with 400; signed webhook/memory suite 8/8. Actual ElevenLabs pre/post-call delivery pair recorded 2026-10-19 and stored caller memory retrieved.

Rollback: restore `~/JU-Call-Transcriber/customer_memory/elevenlabs_relay.backup-before-sbos-proxy-20261019.py` over `elevenlabs_relay.py`, restart with `launchctl kickstart -k gui/$(id -u)/com.ju.jessie-memory-relay`, verify `/health` and signed webhook tests. Preserve memory databases.
