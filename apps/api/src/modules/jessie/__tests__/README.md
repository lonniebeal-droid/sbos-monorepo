# Jessie Integration E2E Test Suite

Comprehensive automated integration/E2E coverage for all seven Jessie contracts.

## Contracts Covered

1. **lookup_client** - Look up a client by ID (tenant-safe)
2. **capture_lead** - Capture a new lead (idempotent)
3. **create_or_request_appointment** - Create confirmed appointment or queue request (idempotent)
4. **transfer_call** - Initiate a call transfer
5. **send_message_or_callback_request** - Queue message or callback request (idempotent)
6. **log_call_outcome** - Log a call outcome (idempotent)
7. **get_business_information** - Get approved business information (tenant-scoped)

## Test Coverage Matrix

| Test Category | lookup_client | capture_lead | create_or_request_appointment | transfer_call | send_message_or_callback_request | log_call_outcome | get_business_information |
|--------------|--------------|--------------|------------------------------|---------------|----------------------------------|------------------|--------------------------|
| Successful Request | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Missing Authentication | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Invalid Authentication | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tenant Isolation / Wrong Tenant | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Malformed Payload Validation | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A (GET) |
| Required Fields | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A (GET) |
| Duplicate Idempotency Behavior | N/A | ✅ | ✅ | N/A | ✅ | ✅ | N/A |
| Parallel Duplicate Requests | N/A | ✅ | ✅ | N/A | ✅ | ✅ | N/A |
| Make Event Names & Payload Shape | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ElevenLabs-Style Request Fixtures | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Database Persistence Verification | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Error Response Security | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Auth Guard Regression | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tenant Isolation Regression | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Idempotency Regression | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## Running the Tests

### Unit Tests (Fast)

```bash
cd apps/api
npm test
```

### E2E Tests Only

```bash
cd apps/api
npx vitest run src/modules/jessie/__tests__/e2e/jessie-integration.e2e.spec.ts
```

### With Coverage

```bash
cd apps/api
npx vitest run --coverage src/modules/jessie/__tests__/e2e/jessie-integration.e2e.spec.ts
```

### Watch Mode (Development)

```bash
cd apps/api
npx vitest src/modules/jessie/__tests__/e2e/jessie-integration.e2e.spec.ts
```

### Smoke Tests (Staging)

```bash
# Using the smoke test harness
cd apps/api
npx tsx src/modules/jessie/__tests__/smoke/staging-smoke-test.ts

# Or against a real staging environment
STAGING_BASE_URL=https://staging-api.example.com \
STAGING_ORG_ID=org-xxx \
STAGING_CLIENT_ID=client-xxx \
STAGING_CONVERSATION_ID=conv-xxx \
STAGING_CLINICIAN_ID=clin-xxx \
JESSIE_SERVICE_SECRET=your-secret \
npx tsx src/modules/jessie/__tests__/smoke/staging-smoke-test.ts
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JESSIE_SERVICE_SECRET` | Service account secret for auth | `test-service-secret-12345` |
| `STAGING_BASE_URL` | Base URL for staging API | `http://localhost:3000` |
| `STAGING_ORG_ID` | Organization ID for staging | `org-550e8400-e29b-41d4-a716-446655440000` |
| `STAGING_CLIENT_ID` | Client ID for staging | `client-550e8400-e29b-41d4-a716-446655440000` |
| `STAGING_CONVERSATION_ID` | Conversation ID for staging | `conv-550e8400-e29b-41d4-a716-446655440000` |
| `STAGING_CLINICIAN_ID` | Clinician ID for staging | `clin-550e8400-e29b-41d4-a716-446655440000` |

## Test Fixtures

Reusable fixtures are located in:
- `src/modules/jessie/__tests__/fixtures/jessie-request.fixtures.ts`

### Key Fixtures

- `lookupClientFixtures` - Valid, invalid, and edge case payloads
- `captureLeadFixtures` - Complete lead capture scenarios
- `createOrRequestAppointmentFixtures` - All appointment types and options
- `transferCallFixtures` - All transfer targets
- `sendMessageOrCallbackFixtures` - SMS, Email, Callback, Internal Note
- `logCallOutcomeFixtures` - All call outcomes
- `elevenLabsStyleFixtures` - ElevenLabs webhook-style payloads
- `authFixtures` - Authentication header variations
- `makeEventFixtures` - Make event validation helpers

## Mock Make Webhook Receiver

Located at `src/modules/jessie/__tests__/mocks/mock-make-webhook.ts`

```typescript
import { MockMakeWebhookReceiver, makeEventShapeValidator } from './mocks/mock-make-webhook';

const receiver = new MockMakeWebhookReceiver();

// Capture events
receiver.capture(event);

// Assertions
receiver.assertEventEmitted('capture_lead', { minCount: 1 });
receiver.assertExactlyOneEvent('transfer_call');
receiver.assertNoEventEmitted('log_call_outcome');
```

## Test Structure

```
src/modules/jessie/__tests__/
├── fixtures/
│   └── jessie-request.fixtures.ts      # Reusable request fixtures
├── mocks/
│   └── mock-make-webhook.ts            # Mock Make webhook receiver
├── e2e/
│   └── jessie-integration.e2e.spec.ts  # Main E2E test suite
└── smoke/
    └── staging-smoke-test.ts           # Staging smoke test harness
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Jessie Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @sbos/api test
      - run: pnpm --filter @sbos/api run lint
      - run: pnpm --filter @sbos/api run build
```

## Lint & TypeCheck

```bash
cd apps/api
npm run lint      # TypeScript type checking
npm run build     # NestJS build (compiles + type checks)
```

## Debugging Tests

### Run Single Test

```bash
cd apps/api
npx vitest run -t "lookup-client: successful request returns client data"
```

### Run Test File with Debug Output

```bash
cd apps/api
npx vitest run src/modules/jessie/__tests__/e2e/jessie-integration.e2e.spec.ts --reporter=verbose
```

## Adding New Tests

1. Add fixtures to `jessie-request.fixtures.ts`
2. Add test cases to `jessie-integration.e2e.spec.ts`
3. Follow existing patterns for consistency
4. Run full test suite to verify

## Troubleshooting

### Tests Timeout

Increase timeout in `vitest.config.ts`:
```typescript
testTimeout: 60_000
```

### Database Connection Issues

Tests use mocked Prisma - no real database needed.

### Port Conflicts

E2E tests use random ports via NestJS TestingModule.

## Production Bugs Found & Fixed

| Bug | Test | Fix |
|-----|------|-----|
| None found during test creation | N/A | N/A |

---

*Generated as part of Agent 5 verification work*