import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Structured request logging: one line per request with method, path, status,
 * duration, and (when authenticated) the acting user + organization — useful for
 * observability without leaking request bodies (which may contain PHI).
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: AuthenticatedUser }>();
    const res = http.getResponse<Response>();
    const start = process.hrtime.bigint();
    const { method, originalUrl } = req;

    return next.handle().pipe(
      tap({
        next: () => this.log(method, originalUrl, res.statusCode, start, req.user),
        error: () => this.log(method, originalUrl, res.statusCode || 500, start, req.user),
      }),
    );
  }

  private log(
    method: string,
    url: string,
    status: number,
    start: bigint,
    user?: AuthenticatedUser,
  ): void {
    const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
    const who = user ? ` user=${user.id} org=${user.organizationId}` : '';
    const line = `${method} ${url} ${status} ${ms.toFixed(1)}ms${who}`;
    if (status >= 500) this.logger.error(line);
    else if (status >= 400) this.logger.warn(line);
    else this.logger.log(line);
  }
}
