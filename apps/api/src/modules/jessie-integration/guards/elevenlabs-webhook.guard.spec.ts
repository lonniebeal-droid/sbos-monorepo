import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ElevenLabsWebhookGuard } from './elevenlabs-webhook.guard';

const mockConfigService = {
  get: vi.fn(),
};

describe('ElevenLabsWebhookGuard', () => {
  let guard: ElevenLabsWebhookGuard;

  beforeEach(() => {
    guard = new ElevenLabsWebhookGuard(mockConfigService as any);
    vi.clearAllMocks();
  });

  const createMockRequest = (headers: Record<string, string>, rawBody: string) => ({
    headers: { 'elevenlabs-signature': headers['x-elevenlabs-signature'] && headers['x-elevenlabs-timestamp'] ? `t=${headers['x-elevenlabs-timestamp']},v0=${headers['x-elevenlabs-signature']}` : undefined },
    rawBody,
  });

  it('should allow valid webhook request', () => {
    const secret = 'test_secret';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({ test: 'data' });
    const crypto = require('crypto');
    const payload = `${timestamp}.${body}`;
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    mockConfigService.get.mockReturnValue(secret);

    const req = createMockRequest(
      {
        'x-elevenlabs-signature': signature,
        'x-elevenlabs-timestamp': timestamp,
      },
      body,
    );

    expect(guard.canActivate({ switchToHttp: () => ({ getRequest: () => req }) } as any)).toBe(true);
  });

  it('should reject missing signature', () => {
    mockConfigService.get.mockReturnValue('test_secret');

    const req = createMockRequest(
      {
        'x-elevenlabs-timestamp': Math.floor(Date.now() / 1000).toString(),
      },
      '{}',
    );

    expect(() =>
      guard.canActivate({ switchToHttp: () => ({ getRequest: () => req }) } as any),
    ).toThrow(UnauthorizedException);
  });

  it('should reject missing timestamp', () => {
    mockConfigService.get.mockReturnValue('test_secret');

    const req = createMockRequest(
      {
        'x-elevenlabs-signature': 'some_signature',
      },
      '{}',
    );

    expect(() =>
      guard.canActivate({ switchToHttp: () => ({ getRequest: () => req }) } as any),
    ).toThrow(UnauthorizedException);
  });

  it('should reject missing raw body', () => {
    mockConfigService.get.mockReturnValue('test_secret');

    const req = createMockRequest(
      {
        'x-elevenlabs-signature': 'some_signature',
        'x-elevenlabs-timestamp': Math.floor(Date.now() / 1000).toString(),
      },
      '',
    );

    expect(() =>
      guard.canActivate({ switchToHttp: () => ({ getRequest: () => req }) } as any),
    ).toThrow(UnauthorizedException);
  });

  it('should reject invalid signature', () => {
    mockConfigService.get.mockReturnValue('test_secret');

    const req = createMockRequest(
      {
        'x-elevenlabs-signature': 'invalid_signature',
        'x-elevenlabs-timestamp': Math.floor(Date.now() / 1000).toString(),
      },
      '{}',
    );

    expect(() =>
      guard.canActivate({ switchToHttp: () => ({ getRequest: () => req }) } as any),
    ).toThrow(UnauthorizedException);
  });

  it('should reject expired timestamp', () => {
    mockConfigService.get.mockReturnValue('test_secret');

    const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString(); // 10 minutes ago
    const req = createMockRequest(
      {
        'x-elevenlabs-signature': 'some_signature',
        'x-elevenlabs-timestamp': oldTimestamp,
      },
      '{}',
    );

    expect(() =>
      guard.canActivate({ switchToHttp: () => ({ getRequest: () => req }) } as any),
    ).toThrow(UnauthorizedException);
  });

  it('should reject when webhook secret not configured', () => {
    mockConfigService.get.mockReturnValue(undefined);

    const req = createMockRequest(
      {
        'x-elevenlabs-signature': 'some_signature',
        'x-elevenlabs-timestamp': Math.floor(Date.now() / 1000).toString(),
      },
      '{}',
    );

    expect(() =>
      guard.canActivate({ switchToHttp: () => ({ getRequest: () => req }) } as any),
    ).toThrow(UnauthorizedException);
  });
});
it.each(['NaN', 'Infinity', '123abc', '', '-1'])('rejects malformed timestamp %s', timestamp => {
 const crypto = require('crypto'); const body='{}'; const key='test';
 const digest=crypto.createHmac('sha256',key).update(`${timestamp}.${body}`).digest('hex');
 const guard=new ElevenLabsWebhookGuard({get:()=>key} as any);
 const req={headers:{'elevenlabs-signature':`t=${timestamp},v0=${digest}`},rawBody:body};
 expect(()=>guard.canActivate({switchToHttp:()=>({getRequest:()=>req})} as any)).toThrow(UnauthorizedException);
});
it('rejects ambiguous repeated timestamp', () => {
 const guard=new ElevenLabsWebhookGuard({get:()=> 'key'} as any);
 const req={headers:{'elevenlabs-signature':`t=1234567890,t=1234567890,v0=${'a'.repeat(64)}`},rawBody:'{}'};
 expect(()=>guard.canActivate({switchToHttp:()=>({getRequest:()=>req})} as any)).toThrow(UnauthorizedException);
});
