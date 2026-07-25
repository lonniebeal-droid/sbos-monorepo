import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AllExceptionsFilter } from './all-exceptions.filter';

function hostFor(url: string) {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('formats an HttpException into the standard envelope', () => {
    const { host, status, json } = hostFor('/api/v1/clients/x');
    filter.catch(new NotFoundException('Client x not found'), host);
    expect(status).toHaveBeenCalledWith(404);
    const body = json.mock.calls[0][0];
    expect(body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      message: 'Client x not found',
      path: '/api/v1/clients/x',
    });
    expect(typeof body.timestamp).toBe('string');
  });

  it('preserves validation message arrays', () => {
    const { host, json } = hostFor('/api/v1/auth/login');
    filter.catch(
      new BadRequestException({
        message: ['email must be an email'],
        error: 'Bad Request',
      }),
      host,
    );
    expect(json.mock.calls[0][0].message).toEqual(['email must be an email']);
  });

  it('hides internals for unknown errors', () => {
    const { host, status, json } = hostFor('/api/v1/boom');
    filter.catch(new Error('secret db detail'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0][0].message).toBe('An unexpected error occurred');
  });
});
