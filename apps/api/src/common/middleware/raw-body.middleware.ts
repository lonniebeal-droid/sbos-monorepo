import { Request, Response, NextFunction } from 'express';

export function rawBodyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const contentType = req.headers['content-type'] ?? '';

  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');
      (req as any).rawBody = rawBody;
      if (rawBody && (contentType.includes('application/json') || contentType.includes('text/'))) {
        try {
          req.body = JSON.parse(rawBody);
        } catch {
          // Ignore parse errors, let the validation pipe handle it
        }
      }
      next();
    });
  } else {
    next();
  }
}