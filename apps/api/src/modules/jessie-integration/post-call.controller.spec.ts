import 'reflect-metadata';
import { describe,it,expect,vi } from 'vitest';
import { JessiePostCallController as Controller } from './post-call.controller';
import { ElevenLabsWebhookGuard } from './guards/elevenlabs-webhook.guard';
const event={type:'post_call_transcription',data:{agent_id:'agent-a',conversation_id:'call-a'}};
function setup(mapping='{"agent-a":"org-a"}') {
 const create=vi.fn().mockResolvedValue({});
 return {create,controller:new Controller({auditLog:{create}} as any,{get:()=>mapping} as any)};
}
describe('signed post-call ingestion',()=>{
 it('enforces signature guard on route',()=>expect(Reflect.getMetadata('__guards__',Controller)).toContain(ElevenLabsWebhookGuard));
 it('rejects unknown agent and invalid mapping before writes',async()=>{
  for(const mapping of ['{}','null','invalid']) {const {create,controller}=setup(mapping);await expect(controller.receive(event)).rejects.toThrow();expect(create).not.toHaveBeenCalled();}
 });
 it('ignores forged org and records server-derived tenant',async()=>{
  const {create,controller}=setup();expect(await controller.receive({...event,organizationId:'victim'})).toEqual({ok:true,duplicate:false});
  expect(create.mock.calls[0][0].data.organizationId).toBe('org-a');
 });
 it('returns duplicate only for unique constraint collision',async()=>{
  const {create,controller}=setup();create.mockRejectedValueOnce({code:'P2002'});expect(await controller.receive(event)).toEqual({ok:true,duplicate:true});
  create.mockRejectedValueOnce(new Error('db down'));await expect(controller.receive(event)).rejects.toThrow('db down');
 });
 it('rejects unsupported payload',async()=>{await expect(setup().controller.receive({type:'post_call_audio'})).rejects.toThrow();});
});
