# Jessie Make delivery configuration

The ChannelsModule registers MAKE_WEBHOOK_PROVIDER. With no MAKE_WEBHOOK_URL, delivery returns not_configured rather than simulated success. To enable real delivery, provision MAKE_WEBHOOK_URL and MAKE_WEBHOOK_API_KEY privately in the target API environment and configure that same API key in the destination Make webhook. Only direct HTTPS hook[.region].make.com URLs without credentials/query strings are accepted. Redirects are blocked. HTTP calls use x-make-apikey and JSON; errors never log webhook URLs, response bodies or exception details.

This is outbound bridge authentication. It does not implement ElevenLabs inbound signature validation, tenant routing in Make, or ingress replay defense. Do not enable customer intake until those are separately verified. No live delivery or paid calls were used for the tests.

## Agent integration route

Use `/api/v1/jessie/agent/integration/*` for agent-secret integrations. The older `/api/v1/jessie/integration/*` alias remains for compatibility, but overlaps legacy JWT routes on several POST operations. Use the dedicated route for new agent tools; it preserves AgentToolsGuard and server-derived tenant mapping.
