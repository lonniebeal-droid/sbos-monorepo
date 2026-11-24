import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { ForbiddenException, Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LoggingInterceptor } from './logging.interceptor';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

function makeHttpContext(opts: {
  method?: string;
  originalUrl?: string;
  statusCode?: number;
  user?: AuthenticatedUser;
}): ExecutionContext {
  const req = {
    method: opts.method ?? 'GET',
    originalUrl: opts.originalUrl ?? '/api/v1/clients',
    user: opts.user,
  };
  const res = { statusCode: opts.statusCode ?? 200 };
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;
}

function handlerReturning(value: unknown): CallHandler {
  return { handle: () => of(value) };
}

function handlerThrowing(err: unknown): CallHandler {
  return { handle: () => throwError(() => err) };
}

describe('LoggingInterceptor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('bypasses logging entirely for non-HTTP contexts (e.g. RPC/WS)', () => {
    const interceptor = new LoggingInterceptor();
    const logSpy = vi.spyOn(Logger.prototype, 'log');
    const context = {
      getType: () => 'rpc',
    } as unknown as ExecutionContext;
    const handler = handlerReturning('ignored');

    const result$ = interceptor.intercept(context, handler);
    result$.subscribe();

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('logs a 2xx response at "log" level without a user segment when unauthenticated', () => {
    const interceptor = new LoggingInterceptor();
    const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const context = makeHttpContext({ method: 'GET', originalUrl: '/api/v1/clients', statusCode: 200 });

    interceptor.intercept(context, handlerReturning({ ok: true })).subscribe();

    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = logSpy.mock.calls[0][0] as string;
    expect(line).toMatch(/^GET \/api\/v1\/clients 200 \d+\.\dms$/);
  });

  it('appends the acting user/organization when the request is authenticated', () => {
    const interceptor = new LoggingInterceptor();
    const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const user = {
      id: 'u1',
      email: 'clinician@sbos.health',
      name: 'Riley Chen',
      role: 'CLINICIAN',
      organizationId: 'org1',
    } as unknown as AuthenticatedUser;
    const context = makeHttpContext({ statusCode: 200, user });

    interceptor.intercept(context, handlerReturning({})).subscribe();

    const line = logSpy.mock.calls[0][0] as string;
    expect(line).toContain('user=u1 org=org1');
  });

  it('logs a 4xx response at "warn" level', () => {
    const interceptor = new LoggingInterceptor();
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const context = makeHttpContext({ statusCode: 404 });

    interceptor.intercept(context, handlerReturning({})).subscribe();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0] as string).toContain(' 404 ');
  });

  it('logs a 5xx response at "error" level', () => {
    const interceptor = new LoggingInterceptor();
    const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const context = makeHttpContext({ statusCode: 503 });

    interceptor.intercept(context, handlerReturning({})).subscribe();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0] as string).toContain(' 503 ');
  });

  it('logs a thrown plain Error at status 500, ignoring the still-default res.statusCode', () => {
    // The global exception filter runs after interceptors, so res.statusCode
    // is still Express's default 200 at the point this error handler fires --
    // regression coverage for a bug where the interceptor logged every thrown
    // error using res.statusCode (still 200) instead of the error's real status.
    const interceptor = new LoggingInterceptor();
    const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const context = makeHttpContext({ statusCode: 200 });

    interceptor
      .intercept(context, handlerThrowing(new Error('boom')))
      .subscribe({ next: () => undefined, error: () => undefined });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0] as string).toContain(' 500 ');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('logs a thrown HttpException using its actual status, not res.statusCode', () => {
    const interceptor = new LoggingInterceptor();
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const context = makeHttpContext({ statusCode: 200 });

    interceptor
      .intercept(context, handlerThrowing(new ForbiddenException()))
      .subscribe({ next: () => undefined, error: () => undefined });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0] as string).toContain(' 403 ');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('propagates the original error from the handler unchanged', () => {
    const interceptor = new LoggingInterceptor();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const context = makeHttpContext({ statusCode: 500 });
    const boom = new Error('boom');
    let caught: unknown;

    interceptor
      .intercept(context, handlerThrowing(boom))
      .subscribe({ next: () => undefined, error: (err: unknown) => (caught = err) });

    expect(caught).toBe(boom);
  });
});
