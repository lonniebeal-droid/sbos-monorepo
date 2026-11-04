#!/usr/bin/env node

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { vi } from 'vitest';

import { JessieModule } from '../../jessie.module';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AuditService } from '../../../../audit/audit.service';
import { SMS_PROVIDER } from '../../../../channels/sms.provider';
import { EMAIL_PROVIDER } from '../../../../channels/email.provider';
import { ConfigService } from '@nestjs/config';

import {
  lookupClientFixtures,
  captureLeadFixtures,
  createOrRequestAppointmentFixtures,
  transferCallFixtures,
  sendMessageOrCallbackFixtures,
  logCallOutcomeFixtures,
  getBusinessInformationFixtures,
  authFixtures,
  VALID_ORG_ID,
  VALID_CLIENT_ID,
  VALID_CONVERSATION_ID,
  VALID_CLINICIAN_ID,
  VALID_SERVICE_SECRET,
} from '../fixtures/jessie-request.fixtures';
import {
  LookupClientRequestDto,
  CaptureLeadRequestDto,
  CreateOrRequestAppointmentRequestDto,
  TransferCallRequestDto,
  SendMessageOrCallbackRequestDto,
  LogCallOutcomeRequestDto,
  CallOutcomeEnum,
  TransferTargetEnum,
} from '../../dto/jessie-integration.dto';

interface SmokeTestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

interface SmokeTestConfig {
  baseUrl: string;
  serviceSecret: string;
  organizationId: string;
  clientId?: string;
  conversationId?: string;
  clinicianId?: string;
}

const DEFAULT_CONFIG: SmokeTestConfig = {
  baseUrl: process.env.STAGING_BASE_URL ?? 'http://localhost:3000',
  serviceSecret: process.env.JESSIE_SERVICE_SECRET ?? VALID_SERVICE_SECRET,
  organizationId: process.env.STAGING_ORG_ID ?? VALID_ORG_ID,
  clientId: process.env.STAGING_CLIENT_ID ?? VALID_CLIENT_ID,
  conversationId: process.env.STAGING_CONVERSATION_ID ?? VALID_CONVERSATION_ID,
  clinicianId: process.env.STAGING_CLINICIAN_ID ?? VALID_CLINICIAN_ID,
};

const mockPrisma = {
  client: { findFirst: vi.fn() },
  lead: { create: vi.fn(), findUnique: vi.fn() },
  appointment: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
  clinician: { findFirst: vi.fn(), findUnique: vi.fn() },
  conversation: { findFirst: vi.fn(), findUnique: vi.fn() },
  callTransfer: { create: vi.fn() },
  callbackRequest: { create: vi.fn(), findUnique: vi.fn() },
  callLog: { create: vi.fn(), findUnique: vi.fn() },
  organization: { findUnique: vi.fn() },
  idempotencyKey: { findUnique: vi.fn(), create: vi.fn() },
  auditLog: { create: vi.fn() },
};

const mockAuditService = { record: vi.fn().mockResolvedValue({}) };
const mockSmsProvider = { send: vi.fn().mockResolvedValue({}) };
const mockEmailProvider = { send: vi.fn().mockResolvedValue({}) };
const mockConfigService = { get: vi.fn((key: string) => key === 'JESSIE_SERVICE_SECRET' ? DEFAULT_CONFIG.serviceSecret : undefined) };

async function createTestApp(): Promise<INestApplication> {
  vi.resetAllMocks();

  mockPrisma.client.findFirst.mockResolvedValue({
    id: DEFAULT_CONFIG.clientId,
    firstName: 'John',
    lastName: 'Doe',
    preferredName: 'Jon',
    mrn: 'MRN-123',
    phone: '+15551234567',
    email: 'john@example.com',
    status: 'ACTIVE',
    primaryClinicianId: DEFAULT_CONFIG.clinicianId,
  });

  mockPrisma.organization.findUnique.mockResolvedValue({
    id: DEFAULT_CONFIG.organizationId,
    name: 'Test Org',
    phone: '+15551234567',
    email: 'info@test.org',
    addressLine1: '123 Main St',
    addressLine2: 'Suite 100',
    city: 'City',
    state: 'ST',
    postalCode: '12345',
    timezone: 'America/New_York',
    isActive: true,
  });

  mockPrisma.idempotencyKey.findUnique.mockResolvedValue(null);
  mockPrisma.idempotencyKey.create.mockResolvedValue({});
  mockPrisma.auditLog.create.mockResolvedValue({});
  mockPrisma.lead.create.mockResolvedValue({ id: 'lead-1' });
  mockPrisma.lead.findUnique.mockResolvedValue({ id: 'lead-1' });
  mockPrisma.appointment.create.mockResolvedValue({
    id: 'appt-1',
    status: 'SCHEDULED',
    startTime: new Date('2026-09-15T10:00:00.000Z'),
  });
  mockPrisma.appointment.findFirst.mockResolvedValue(null);
  mockPrisma.appointment.findUnique.mockResolvedValue({
    id: 'appt-1',
    status: 'SCHEDULED',
    startTime: new Date('2026-09-15T10:00:00.000Z'),
  });
  mockPrisma.clinician.findFirst.mockResolvedValue({ id: DEFAULT_CONFIG.clinicianId, isAcceptingNewClients: true });
  mockPrisma.clinician.findUnique.mockResolvedValue({ id: DEFAULT_CONFIG.clinicianId });
  mockPrisma.conversation.findFirst.mockResolvedValue({
    id: DEFAULT_CONFIG.conversationId,
    clientId: DEFAULT_CONFIG.clientId,
  });
  mockPrisma.conversation.findUnique.mockResolvedValue({
    id: DEFAULT_CONFIG.conversationId,
    clientId: DEFAULT_CONFIG.clientId,
  });
  mockPrisma.callTransfer.create.mockResolvedValue({ id: 'transfer-1' });
  mockPrisma.callbackRequest.create.mockResolvedValue({ id: 'cb-1', status: 'QUEUED' });
  mockPrisma.callbackRequest.findUnique.mockResolvedValue({ id: 'cb-1', status: 'QUEUED' });
  mockPrisma.callLog.create.mockResolvedValue({ id: 'log-1' });
  mockPrisma.callLog.findUnique.mockResolvedValue({ id: 'log-1' });

  const module = await Test.createTestingModule({
    imports: [JessieModule],
  })
    .overrideProvider(PrismaService)
    .useValue(mockPrisma)
    .overrideProvider(AuditService)
    .useValue(mockAuditService)
    .overrideProvider(SMS_PROVIDER)
    .useValue(mockSmsProvider)
    .overrideProvider(EMAIL_PROVIDER)
    .useValue(mockEmailProvider)
    .overrideProvider(ConfigService)
    .useValue(mockConfigService)
    .compile();

  const app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      errorHttpStatusCode: 400,
    })
  );
  await app.init();
  return app;
}

function getAuthHeaders(config: SmokeTestConfig) {
  return {
    authorization: `Bearer ${config.serviceSecret}`,
    'x-organization-id': config.organizationId,
  };
}

async function runSmokeTest(
  name: string,
  fn: () => Promise<void>
): Promise<SmokeTestResult> {
  const start = Date.now();
  try {
    await fn();
    return { name, passed: true, duration: Date.now() - start };
  } catch (error) {
    return { name, passed: false, duration: Date.now() - start, error: String(error) };
  }
}

async function smokeTestSuite(config: SmokeTestConfig = DEFAULT_CONFIG): Promise<SmokeTestResult[]> {
  const app = await createTestApp();
  const results: SmokeTestResult[] = [];

  const makeRequest = (endpoint: string, method: 'get' | 'post' = 'post', body?: any, headers?: Record<string, string>) => {
    const req = request(app.getHttpServer())[method](`/v1/jessie/integration/${endpoint}`);
    const requestHeaders = headers ?? getAuthHeaders(config);
    req.set(requestHeaders);
    if (body) req.send(body);
    return req;
  };

  console.log('🚀 Starting Jessie Integration Smoke Tests');
  console.log(`   Base URL: ${config.baseUrl}`);
  console.log(`   Organization: ${config.organizationId}`);
  console.log('');

  results.push(await runSmokeTest('Health Check - Auth Valid', async () => {
    const res = await makeRequest('business-information', 'get');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.body.success) throw new Error('Expected success=true');
    if (!res.body.data?.name) throw new Error('Missing business name');
  }));

  results.push(await runSmokeTest('lookup-client - Valid Request', async () => {
    const res = await makeRequest('lookup-client', 'post', lookupClientFixtures.valid({ clientId: config.clientId! }));
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.body.success) throw new Error('Expected success=true');
    if (!res.body.data?.clientId) throw new Error('Missing clientId in response');
  }));

  results.push(await runSmokeTest('capture-lead - Valid Request', async () => {
    const res = await makeRequest('capture-lead', 'post', captureLeadFixtures.valid({
      firstName: 'Smoke',
      lastName: 'Test',
      idempotencyKey: `smoke-${Date.now()}`,
    }));
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.body.success) throw new Error('Expected success=true');
    if (!res.body.data?.leadId) throw new Error('Missing leadId');
  }));

  results.push(await runSmokeTest('create-or-request-appointment - Valid Request', async () => {
    const res = await makeRequest('create-or-request-appointment', 'post', createOrRequestAppointmentFixtures.valid({
      clientId: config.clientId!,
      idempotencyKey: `smoke-${Date.now()}`,
    }));
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.body.success) throw new Error('Expected success=true');
    if (!res.body.data?.appointmentId) throw new Error('Missing appointmentId');
  }));

  results.push(await runSmokeTest('transfer-call - Valid Request', async () => {
    const res = await makeRequest('transfer-call', 'post', transferCallFixtures.valid({
      conversationId: config.conversationId!,
    }));
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.body.success) throw new Error('Expected success=true');
    if (!res.body.data?.transferId) throw new Error('Missing transferId');
  }));

  results.push(await runSmokeTest('send-message-or-callback-request - Valid Request', async () => {
    const res = await makeRequest('send-message-or-callback-request', 'post', sendMessageOrCallbackFixtures.valid({
      clientId: config.clientId!,
      idempotencyKey: `smoke-${Date.now()}`,
    }));
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.body.success) throw new Error('Expected success=true');
    if (!res.body.data?.requestId) throw new Error('Missing requestId');
  }));

  results.push(await runSmokeTest('log-call-outcome - Valid Request', async () => {
    const res = await makeRequest('log-call-outcome', 'post', logCallOutcomeFixtures.valid({
      conversationId: config.conversationId!,
      idempotencyKey: `smoke-${Date.now()}`,
    }));
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.body.success) throw new Error('Expected success=true');
    if (!res.body.data?.logId) throw new Error('Missing logId');
  }));

  results.push(await runSmokeTest('get-business-information - Valid Request', async () => {
    const res = await makeRequest('business-information', 'get');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.body.success) throw new Error('Expected success=true');
    if (!res.body.data?.name) throw new Error('Missing business name');
  }));

  results.push(await runSmokeTest('Auth - Missing Authorization Header', async () => {
    const req = request(app.getHttpServer()).post('/v1/jessie/integration/lookup-client');
    req.set({ 'x-organization-id': config.organizationId });
    req.send(lookupClientFixtures.valid());
    const res = await req;
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  }));

  results.push(await runSmokeTest('Auth - Invalid Token', async (): Promise<void> => {
    const res = await makeRequest('lookup-client', 'post', lookupClientFixtures.valid(), {
      authorization: 'Bearer invalid-token',
      'x-organization-id': config.organizationId,
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  }));

  results.push(await runSmokeTest('Auth - Missing Organization ID', async () => {
    const req = request(app.getHttpServer()).post('/v1/jessie/integration/lookup-client');
    req.set({ authorization: `Bearer ${config.serviceSecret}` });
    req.send(lookupClientFixtures.valid());
    const res = await req;
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  }));

  results.push(await runSmokeTest('Validation - lookup-client Missing clientId', async () => {
    const res = await makeRequest('lookup-client', 'post', {});
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  }));

  results.push(await runSmokeTest('Validation - capture-lead Missing Required Fields', async () => {
    const res = await makeRequest('capture-lead', 'post', { firstName: 'Test' });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  }));

  results.push(await runSmokeTest('Validation - create-or-request-appointment Missing Required Fields', async () => {
    const res = await makeRequest('create-or-request-appointment', 'post', { clientId: config.clientId });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  }));

  results.push(await runSmokeTest('Validation - transfer-call Missing Required Fields', async () => {
    const res = await makeRequest('transfer-call', 'post', { conversationId: config.conversationId });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  }));

  results.push(await runSmokeTest('Validation - send-message-or-callback-request Missing Required Fields', async () => {
    const res = await makeRequest('send-message-or-callback-request', 'post', { clientId: config.clientId });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  }));

  results.push(await runSmokeTest('Validation - log-call-outcome Missing Required Fields', async () => {
    const res = await makeRequest('log-call-outcome', 'post', { conversationId: config.conversationId });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  }));

  results.push(await runSmokeTest('Idempotency - capture-lead Duplicate Key Returns EXISTS', async () => {
    const key = `smoke-idempotent-${Date.now()}`;
    mockPrisma.idempotencyKey.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ resourceId: 'lead-1', resourceType: 'Lead' });

    const res1 = await makeRequest('capture-lead', 'post', captureLeadFixtures.valid({ idempotencyKey: key }));
    if (res1.body.data.status !== 'CREATED') throw new Error('First request should be CREATED');

    const res2 = await makeRequest('capture-lead', 'post', captureLeadFixtures.valid({ idempotencyKey: key }));
    if (res2.body.data.status !== 'EXISTS') throw new Error('Second request should be EXISTS');
  }));

  results.push(await runSmokeTest('Idempotency - create-or-request-appointment Duplicate Key Returns EXISTS', async () => {
    const key = `smoke-idempotent-${Date.now()}`;
    mockPrisma.idempotencyKey.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ resourceId: 'appt-1', resourceType: 'Appointment' });

    const res1 = await makeRequest('create-or-request-appointment', 'post', createOrRequestAppointmentFixtures.valid({ clientId: config.clientId!, idempotencyKey: key }));
    if (res1.body.data.status !== 'CONFIRMED') throw new Error('First request should be CONFIRMED');

    const res2 = await makeRequest('create-or-request-appointment', 'post', createOrRequestAppointmentFixtures.valid({ clientId: config.clientId!, idempotencyKey: key }));
    if (res2.body.data.status !== 'EXISTS') throw new Error('Second request should be EXISTS');
  }));

  results.push(await runSmokeTest('Tenant Isolation - lookup-client Rejects Other Org Client', async () => {
    mockPrisma.client.findFirst.mockResolvedValue(null);
    const res = await makeRequest('lookup-client', 'post', lookupClientFixtures.valid({ clientId: 'other-org-client' }));
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.body.success !== false) throw new Error('Expected success=false for other org client');
  }));

  await app.close();
  return results;
}

function printResults(results: SmokeTestResult[]): void {
  console.log('\n📊 Smoke Test Results');
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name} (${result.duration}ms)`);
    if (!result.passed) {
      console.log(`   Error: ${result.error}`);
      failed++;
    } else {
      passed++;
    }
  }

  console.log('='.repeat(60));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  smokeTestSuite().then(printResults).catch((err) => {
    console.error('❌ Smoke test suite crashed:', err);
    process.exit(1);
  });
}

export { smokeTestSuite, SmokeTestConfig, SmokeTestResult, createTestApp };