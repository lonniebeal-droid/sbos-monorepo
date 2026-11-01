import {describe,it,expect,vi} from 'vitest';
import {JessieIntegrationService} from './jessie-integration.service';
const cases = [['captureLead','leadId'],['createAppointmentRequest','appointmentRequestId'],['sendMessageOrCallbackRequest','messageId'],['logCallOutcome','outcomeId']] as const;
describe.each(cases)('Jessie %s cache tenant isolation',(method,field)=>{
 it('keeps identical request IDs separate per organization and reuses each own result',async()=>{
  const prisma:any={
   organization:{findFirst:vi.fn(async({where}:any)=>({id:where.id,name:where.id,slug:where.id,timezone:'America/New_York',locations:[],isActive:true}))},
   user:{findFirst:vi.fn(async()=>({id:'synthetic-staff'}))},
   task:{findFirst:vi.fn(async()=>null),create:vi.fn(async({data}:any)=>({id:data.organizationId+'-task',createdAt:new Date('2026-10-21T00:00:00Z')}))}
  };
  const service:any=new JessieIntegrationService(prisma,{record:vi.fn()} as any);
  const dto=(org:string)=>({clientId:org,requestId:'shared-request',conversationId:'synthetic',callerName:'Synthetic Test',callerPhone:'+15550000001',service:'Consultation',reasonForCall:'Synthetic',requestedDate:'2026-11-05',requestedTime:'12:30:00',timezone:'America/New_York',callbackRequested:true,message:'Synthetic',intent:'booking',resolution:'resolved',leadQuality:'qualified',urgency:'normal',callSummary:'Synthetic fixture',followUpRequired:false});
  const first=await service[method]('org_a',dto('org_a'));
  const second=await service[method]('org_b',dto('org_b'));
  const retry=await service[method]('org_a',dto('org_a'));
  expect(first[field]).toBe('org_a-task');
  expect(second[field]).toBe('org_b-task');
  expect(retry[field]).toBe('org_a-task');
  expect(prisma.task.create).toHaveBeenCalledTimes(2);
 });
});
