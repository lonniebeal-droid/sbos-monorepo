import { BadRequestException, Body, Controller, HttpCode, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ElevenLabsWebhookGuard } from './guards/elevenlabs-webhook.guard';
@Public()
@Controller({ path: 'jessie/webhooks', version: '1' })
@UseGuards(ElevenLabsWebhookGuard)
export class JessiePostCallController {
 constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}
 @Post('elevenlabs') @HttpCode(200)
 async receive(@Body() body: any) {
  if (body?.type !== 'post_call_transcription' || typeof body.data?.agent_id !== 'string' || typeof body.data?.conversation_id !== 'string' || body.data.conversation_id.length > 256) throw new BadRequestException('Unsupported post-call event');
  let mapping: Record<string,string>;
  try { mapping=JSON.parse(this.config.get<string>('JESSIE_WEBHOOK_AGENT_ORGS') || '{}'); }
  catch { throw new UnauthorizedException('Webhook agent mapping unavailable'); }
  const org=mapping && typeof mapping === 'object' && Object.prototype.hasOwnProperty.call(mapping,body.data.agent_id) ? mapping[body.data.agent_id] : undefined;
  if(typeof org !== 'string' || !org) throw new UnauthorizedException('Webhook agent not authorized');
  const id='jessie-postcall-'+createHash('sha256').update(JSON.stringify([org,body.data.agent_id,body.type,body.data.conversation_id])).digest('hex');
  try {
   await this.prisma.auditLog.create({data:{id,organizationId:org,action:'CREATE',entityType:'JessiePostCall',entityId:body.data.conversation_id,metadata:{event:body.type,agentId:body.data.agent_id,conversationId:body.data.conversation_id,status:'received'}}});
  } catch(e:any) { if(e?.code==='P2002') return {ok:true,duplicate:true}; throw e; }
  return {ok:true,duplicate:false};
 }
}
