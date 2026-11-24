import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { ChannelsModule } from './channels.module';
import { createMakeWebhookProvider as make, MAKE_WEBHOOK_PROVIDER as token, type MakeWebhookPayload } from './make-webhook.provider';
const payload: MakeWebhookPayload = { event: 'lead_created', organizationId: 'a', clientId: 'c', data: {}, timestamp: '2026-10-22' };
afterEach(() => vi.unstubAllGlobals());
describe('Make wiring', () => {
 it('exports and registers provider', () => {
  expect(Reflect.getMetadata('exports', ChannelsModule)).toContain(token);
  expect(Reflect.getMetadata('providers', ChannelsModule).some((p: any) => p.provide === token)).toBe(true);
 });
 it('does not claim disabled delivery', async () => {
  expect(await make().send(payload)).toEqual({ok:false,error:'not_configured'});
 });
 it.each(['http://hook.us2.make.com/x','https://evil.example/x','https://hook.us2.make.com.evil.example/x','https://u:p@hook.us2.make.com/x','https://hook.us2.make.com/x?k=s'])('rejects unsafe URL %s', url => expect(() => make(url,'key')).toThrow());
 it('requires authentication', () => expect(() => make('https://hook.us2.make.com/x')).toThrow('MAKE_WEBHOOK_API_KEY'));
 it('sends key and blocks redirects', async () => {
  const fetcher=vi.fn().mockResolvedValue({ok:true,status:200});vi.stubGlobal('fetch',fetcher);
  expect((await make('https://hook.us2.make.com/x','key').send(payload)).ok).toBe(true);
  expect(fetcher).toHaveBeenCalledWith('https://hook.us2.make.com/x',expect.objectContaining({redirect:'error',headers:{'Content-Type':'application/json','x-make-apikey':'key'}}));
 });
});

it('keeps webhook secrets and upstream text out of error logs', async () => {
 const log=vi.spyOn(Logger.prototype,'error').mockImplementation(() => {});
 try {
  const provider=make('https://hook.us2.make.com/private-path','private-key');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:500,text:async () => 'private-body'}));
  await provider.send(payload);
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('private-exception')));
  await provider.send(payload);
  for(const value of ['private-path','private-key','private-body','private-exception']) expect(JSON.stringify(log.mock.calls)).not.toContain(value);
 } finally { log.mockRestore(); }
});
