/**
 * ElevenLabs Tool Request/Response Schemas
 * 
 * Purpose: Type-safe validation schemas for all 7 Jessie-ElevenLabs tool contracts.
 * Location: Agent 4 worktree only — does not touch Agent 3 backend code.
 * Usage: Import in integration tests, Make webhook validators, or standalone validation.
 * 
 * These schemas mirror the exact contracts defined in docs/integration/ELEVENLABS_TOOL_SCHEMAS.md
 */

import { z } from 'zod';

// ============================================================================
// Common Base Types
// ============================================================================

export const OrganizationIdSchema = z.string().cuid();
export const ConversationIdSchema = z.string().cuid();
export const ClientIdSchema = z.string().cuid();
export const ClinicianIdSchema = z.string().cuid();
export const LocationIdSchema = z.string().cuid();
export const TaskIdSchema = z.string().cuid();
export const TransferIdSchema = z.string().cuid();
export const AppointmentIdSchema = z.string().cuid();
export const EventIdSchema = z.string().regex(/^evt_[a-z0-9]+$/);

export const ISODateTimeSchema = z.string().datetime();
export const ISODateSchema = z.string().date();
export const E164PhoneSchema = z.string().regex(/^\+1\d{10}$/);
export const EmailSchema = z.string().email();

export const ToolErrorCodeSchema = z.enum([
  'TOOL_ERROR',
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'UNAUTHORIZED',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
]);

export const AssistantKindSchema = z.enum([
  'RECEPTIONIST',
  'SCHEDULING',
  'INTAKE',
  'CLINICAL',
  'KNOWLEDGE',
  'GENERAL',
]);

export const ClientStatusSchema = z.enum([
  'PROSPECT',
  'INTAKE',
  'ACTIVE',
  'ON_HOLD',
  'DISCHARGED',
  'INACTIVE',
]);

export const GenderSchema = z.enum([
  'MALE',
  'FEMALE',
  'NON_BINARY',
  'TRANSGENDER',
  'OTHER',
  'UNKNOWN',
  'DECLINED',
]);

export const AppointmentTypeSchema = z.enum([
  'INTAKE',
  'INDIVIDUAL',
  'GROUP',
  'FAMILY',
  'COUPLES',
  'MEDICATION_MANAGEMENT',
  'ASSESSMENT',
  'TELEHEALTH',
  'CONSULTATION',
]);

export const AppointmentStatusSchema = z.enum([
  'SCHEDULED',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_SESSION',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
  'RESCHEDULED',
]);

export const TransferTypeSchema = z.enum(['WARM', 'COLD']);
export const TransferDestinationTypeSchema = z.enum([
  'EXTENSION',
  'EXTERNAL_NUMBER',
  'VOICEMAIL',
  'QUEUE',
  'ON_CALL',
]);
export const TransferStatusSchema = z.enum([
  'INITIATED',
  'CONNECTED',
  'FAILED',
  'VOICEMAIL',
]);

export const MessageTypeSchema = z.enum([
  'SMS_STAFF',
  'EMAIL_STAFF',
  'CALLBACK_REQUEST',
  'VOICEMAIL_NOTIFICATION',
]);

export const RecipientRoleSchema = z.enum([
  'FRONT_DESK',
  'BILLING',
  'CLINICAL_ON_CALL',
  'SUPERVISOR',
  'ALL_STAFF',
]);

export const CallbackPrioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);

export const CallOutcomeSchema = z.enum([
  'APPOINTMENT_BOOKED',
  'LEAD_CAPTURED',
  'TRANSFERRED_TO_HUMAN',
  'VOICEMAIL_LEFT',
  'CALLBACK_REQUESTED',
  'INFORMATION_PROVIDED',
  'CALLER_HANGUP',
  'ERROR',
]);

export const BusinessInfoCategorySchema = z.enum([
  'HOURS',
  'LOCATION',
  'SERVICES',
  'INSURANCE',
  'CLINICIANS',
  'PRICING',
  'ALL',
]);

export const EmergencySeveritySchema = z.enum(['CRITICAL']);
export const EmergencyTriggerSchema = z.enum(['KEYWORD_DETECTED', 'INTENT_CLASSIFIED']);
export const EscalationReasonSchema = z.enum(['CLINICAL_CRISIS', 'EMERGENCY', 'HARM_TO_OTHERS']);

// ============================================================================
// Tool Request Schemas
// ============================================================================

// 1. lookup_client
export const LookupClientRequestSchema = z.object({
  organizationId: OrganizationIdSchema,
  mrn: z.string().max(50).optional(),
  phone: E164PhoneSchema.optional(),
  email: EmailSchema.optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  dateOfBirth: ISODateSchema.optional(),
}).refine(
  (data: Record<string, unknown>) => ['mrn', 'phone', 'email', 'firstName'].some((k) => data[k] !== undefined),
  { message: 'At least one identifier beyond organizationId required' }
);

export type LookupClientRequest = z.infer<typeof LookupClientRequestSchema>;

// 2. capture_lead
export const CaptureLeadRequestSchema = z.object({
  organizationId: OrganizationIdSchema,
  mrn: z.string().max(50).optional(),
  firstName: z.string().max(100),
  lastName: z.string().max(100),
  preferredName: z.string().max(100).optional(),
  dateOfBirth: ISODateSchema,
  gender: GenderSchema.default('UNKNOWN'),
  pronouns: z.string().max(50).optional(),
  email: EmailSchema.optional(),
  phone: E164PhoneSchema.optional(),
  presentingConcern: z.string().max(500).optional(),
  insuranceCarrier: z.string().max(100).optional(),
  insuranceMemberId: z.string().max(50).optional(),
  insuranceGroupNumber: z.string().max(50).optional(),
  source: z.enum(['PHONE', 'CHAT', 'WEB_FORM', 'REFERRAL']).default('PHONE'),
  notes: z.string().max(1000).optional(),
});

export type CaptureLeadRequest = z.infer<typeof CaptureLeadRequestSchema>;

// 3. create_or_request_appointment
// Base input type for refinement (avoids circular reference)
export interface CreateOrRequestAppointmentInput {
  organizationId: string;
  clientId?: string;
  clinicianId?: string;
  locationId?: string;
  type?: 'INTAKE' | 'INDIVIDUAL' | 'GROUP' | 'FAMILY' | 'COUPLES' | 'MEDICATION_MANAGEMENT' | 'ASSESSMENT' | 'TELEHEALTH' | 'CONSULTATION';
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  isTelehealth?: boolean;
  cptCode?: string;
  action?: 'CHECK_AVAILABILITY' | 'BOOK';
}

export const CreateOrRequestAppointmentRequestSchema = z.object({
  organizationId: OrganizationIdSchema,
  clientId: ClientIdSchema.optional(),
  clinicianId: ClinicianIdSchema.optional(),
  locationId: LocationIdSchema.optional(),
  type: AppointmentTypeSchema.default('INDIVIDUAL'),
  startTime: ISODateTimeSchema.optional(),
  endTime: ISODateTimeSchema.optional(),
  durationMinutes: z.number().int().min(15).max(240).default(50),
  isTelehealth: z.boolean().default(false),
  cptCode: z.string().max(10).optional(),
  action: z.enum(['CHECK_AVAILABILITY', 'BOOK']).default('BOOK'),
}).superRefine((data: CreateOrRequestAppointmentInput, ctx: z.RefinementCtx) => {
    if (data.action === 'BOOK') {
      if (!data.clientId) ctx.addIssue({ code: 'custom', message: 'clientId required for BOOK', path: ['clientId'] });
      if (!data.clinicianId) ctx.addIssue({ code: 'custom', message: 'clinicianId required for BOOK', path: ['clinicianId'] });
      if (!data.startTime) ctx.addIssue({ code: 'custom', message: 'startTime required for BOOK', path: ['startTime'] });
      if (!data.endTime) ctx.addIssue({ code: 'custom', message: 'endTime required for BOOK', path: ['endTime'] });
    } else {
      if (!data.clinicianId) ctx.addIssue({ code: 'custom', message: 'clinicianId required for CHECK_AVAILABILITY', path: ['clinicianId'] });
      if (!data.startTime) ctx.addIssue({ code: 'custom', message: 'startTime (date portion) required for CHECK_AVAILABILITY', path: ['startTime'] });
    }
  });

export type CreateOrRequestAppointmentRequest = z.infer<typeof CreateOrRequestAppointmentRequestSchema>;

// 4. transfer_call
export const TransferDestinationSchema = z.object({
  type: TransferDestinationTypeSchema,
  value: z.string().min(1),
  name: z.string().optional(),
});

export const TransferCallRequestSchema = z.object({
  organizationId: OrganizationIdSchema,
  conversationId: ConversationIdSchema,
  destination: TransferDestinationSchema,
  transferType: TransferTypeSchema.default('WARM'),
  contextSummary: z.string().max(500).optional(),
  fallbackDestination: TransferDestinationSchema.optional(),
});

export type TransferCallRequest = z.infer<typeof TransferCallRequestSchema>;

// 5. send_message_or_callback_request
export const CallbackDetailsSchema = z.object({
  callerName: z.string().min(1),
  callerPhone: E164PhoneSchema,
  bestTimeToCall: z.string().optional(),
  reason: z.string().min(1),
  priority: CallbackPrioritySchema.default('NORMAL'),
});

// Base input type for refinement (avoids circular reference)
export interface SendMessageOrCallbackInput {
  organizationId: string;
  conversationId: string;
  type: 'SMS_STAFF' | 'EMAIL_STAFF' | 'CALLBACK_REQUEST' | 'VOICEMAIL_NOTIFICATION';
  recipient: {
    role: 'FRONT_DESK' | 'BILLING' | 'CLINICAL_ON_CALL' | 'SUPERVISOR' | 'ALL_STAFF';
    userId?: string;
    phone?: string;
    email?: string;
  };
  subject?: string;
  body?: string;
  callbackDetails?: {
    callerName: string;
    callerPhone: string;
    bestTimeToCall?: string;
    reason: string;
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  };
}

export const SendMessageOrCallbackRequestSchema = z.object({
  organizationId: OrganizationIdSchema,
  conversationId: ConversationIdSchema,
  type: MessageTypeSchema,
  recipient: z.object({
    role: RecipientRoleSchema,
    userId: z.string().cuid().optional(),
    phone: E164PhoneSchema.optional(),
    email: EmailSchema.optional(),
  }),
  subject: z.string().max(200).optional(),
  body: z.string().max(2000).optional(),
  callbackDetails: CallbackDetailsSchema.optional(),
}).superRefine((data: SendMessageOrCallbackInput, ctx: z.RefinementCtx) => {
    if (data.type === 'CALLBACK_REQUEST' && !data.callbackDetails) {
      ctx.addIssue({ code: 'custom', message: 'callbackDetails required for CALLBACK_REQUEST', path: ['callbackDetails'] });
    }
  });

export type SendMessageOrCallbackRequest = z.infer<typeof SendMessageOrCallbackRequestSchema>;

// 6. log_call_outcome
export const LogCallOutcomeRequestSchema = z.object({
  organizationId: OrganizationIdSchema,
  conversationId: ConversationIdSchema,
  outcome: CallOutcomeSchema,
  summary: z.string().max(1000),
  appointmentId: AppointmentIdSchema.optional(),
  clientId: ClientIdSchema.optional(),
  transferDestination: z.string().optional(),
  durationSeconds: z.number().int().min(0).optional(),
  tags: z.array(z.string()).max(10).optional(),
});

export type LogCallOutcomeRequest = z.infer<typeof LogCallOutcomeRequestSchema>;

// 7. get_business_information
export const GetBusinessInformationRequestSchema = z.object({
  organizationId: OrganizationIdSchema,
  category: BusinessInfoCategorySchema,
  filters: z.object({
    serviceType: AppointmentTypeSchema.optional(),
    insuranceCarrier: z.string().optional(),
    clinicianId: ClinicianIdSchema.optional(),
  }).optional(),
});

export type GetBusinessInformationRequest = z.infer<typeof GetBusinessInformationRequestSchema>;

// ============================================================================
// Tool Response Schemas
// ============================================================================

export const ToolSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.unknown(), // Tool-specific
  requestId: z.string().regex(/^req_[a-z0-9]+$/),
  timestamp: ISODateTimeSchema,
});

export const ToolErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: ToolErrorCodeSchema,
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
  requestId: z.string().regex(/^req_[a-z0-9]+$/),
  timestamp: ISODateTimeSchema,
});

export const ToolResponseSchema = z.union([ToolSuccessResponseSchema, ToolErrorResponseSchema]);

// Tool-specific success data schemas
export const LookupClientSuccessDataSchema = z.object({
  client: z.object({
    id: ClientIdSchema,
    mrn: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    preferredName: z.string().nullable(),
    dateOfBirth: ISODateSchema,
    gender: GenderSchema,
    pronouns: z.string().nullable(),
    email: EmailSchema.nullable(),
    phone: E164PhoneSchema.nullable(),
    status: ClientStatusSchema,
    primaryClinicianId: ClinicianIdSchema.nullable(),
    organizationId: OrganizationIdSchema,
    createdAt: ISODateTimeSchema,
    updatedAt: ISODateTimeSchema,
  }),
});

export const CaptureLeadSuccessDataSchema = z.object({
  client: z.object({
    id: ClientIdSchema,
    mrn: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    status: z.literal('INTAKE'),
    organizationId: OrganizationIdSchema,
    createdAt: ISODateTimeSchema,
    updatedAt: ISODateTimeSchema,
  }),
});

export const AvailabilitySlotSchema = z.object({
  startTime: ISODateTimeSchema,
  endTime: ISODateTimeSchema,
  clinicianId: ClinicianIdSchema,
  clinicianName: z.string(),
  locationId: LocationIdSchema.optional(),
  locationName: z.string().optional(),
});

export const CheckAvailabilitySuccessDataSchema = z.object({
  slots: z.array(AvailabilitySlotSchema),
});

export const BookAppointmentSuccessDataSchema = z.object({
  appointment: z.object({
    id: AppointmentIdSchema,
    clientId: ClientIdSchema,
    clinicianId: ClinicianIdSchema,
    locationId: LocationIdSchema.nullable(),
    type: AppointmentTypeSchema,
    status: AppointmentStatusSchema,
    startTime: ISODateTimeSchema,
    endTime: ISODateTimeSchema,
    durationMinutes: z.number().int(),
    isTelehealth: z.boolean(),
    cptCode: z.string().nullable(),
    organizationId: OrganizationIdSchema,
    createdAt: ISODateTimeSchema,
    updatedAt: ISODateTimeSchema,
  }),
});

export const TransferCallSuccessDataSchema = z.object({
  transferId: TransferIdSchema,
  status: TransferStatusSchema,
  destination: TransferDestinationSchema,
  connectedAt: ISODateTimeSchema.optional(),
});

export const SendMessageSuccessDataSchema = z.object({
  notificationId: z.string().cuid(),
  deliveryStatus: z.record(z.enum(['SENT', 'QUEUED', 'FAILED', 'PENDING'])),
  taskId: TaskIdSchema.optional(),
});

export const LogCallOutcomeSuccessDataSchema = z.object({
  conversationId: ConversationIdSchema,
  outcome: CallOutcomeSchema,
  loggedAt: ISODateTimeSchema,
});

export const BusinessHoursSchema = z.record(z.union([
  z.object({ open: z.string(), close: z.string(), closed: z.boolean().optional() }),
  z.object({ closed: z.literal(true) }),
]));

export const LocationInfoSchema = z.object({
  name: z.string(),
  addressLine1: z.string().nullable(),
  addressLine2: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postalCode: z.string().nullable(),
  phone: E164PhoneSchema.nullable(),
});

export const ServiceInfoSchema = z.object({
  code: z.string(),
  description: z.string(),
  defaultFee: z.number(),
  type: AppointmentTypeSchema,
});

export const InsuranceInfoSchema = z.object({
  name: z.string(),
  payerId: z.string().nullable(),
  planTypes: z.array(z.string()).optional(),
});

export const ClinicianInfoSchema = z.object({
  id: ClinicianIdSchema,
  name: z.string(),
  credentials: z.string().nullable(),
  specialties: z.array(z.string()),
  acceptingNew: z.boolean(),
});

export const GetBusinessInformationSuccessDataSchema = z.object({
  hours: z.object({
    timezone: z.string(),
    hours: BusinessHoursSchema,
    afterHoursMessage: z.string().optional(),
  }).optional(),
  location: LocationInfoSchema.optional(),
  services: z.array(ServiceInfoSchema).optional(),
  insurance: z.array(InsuranceInfoSchema).optional(),
  clinicians: z.array(ClinicianInfoSchema).optional(),
});

// ============================================================================
// Webhook Event Schemas (SBOS → Make / ElevenLabs)
// ============================================================================

export const BaseWebhookEventSchema = z.object({
  event: z.string(),
  eventId: EventIdSchema,
  timestamp: ISODateTimeSchema,
  organizationId: OrganizationIdSchema,
  organizationName: z.string(),
  conversationId: ConversationIdSchema.optional(),
});

export const LeadCapturedEventSchema = BaseWebhookEventSchema.extend({
  event: z.literal('lead.captured'),
  data: z.object({
    clientId: ClientIdSchema,
    mrn: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    preferredName: z.string().nullable(),
    dateOfBirth: ISODateSchema,
    gender: GenderSchema,
    pronouns: z.string().nullable(),
    email: EmailSchema.nullable(),
    phone: E164PhoneSchema,
    presentingConcern: z.string(),
    insuranceCarrier: z.string().nullable(),
    insuranceMemberId: z.string().nullable(),
    insuranceGroupNumber: z.string().nullable(),
    source: z.enum(['PHONE', 'CHAT', 'WEB_FORM', 'REFERRAL']),
    notes: z.string().nullable(),
    conversationDurationSeconds: z.number().int(),
  }),
});

export const AppointmentBookedEventSchema = BaseWebhookEventSchema.extend({
  event: z.literal('appointment.booked'),
  data: z.object({
    appointmentId: AppointmentIdSchema,
    clientId: ClientIdSchema,
    clientMrn: z.string(),
    clientName: z.string(),
    clinicianId: ClinicianIdSchema,
    clinicianName: z.string(),
    locationId: LocationIdSchema,
    locationName: z.string(),
    type: AppointmentTypeSchema,
    status: AppointmentStatusSchema,
    startTime: ISODateTimeSchema,
    endTime: ISODateTimeSchema,
    durationMinutes: z.number().int(),
    isTelehealth: z.boolean(),
    cptCode: z.string().nullable(),
    confirmationSent: z.boolean(),
    confirmationChannel: z.enum(['SMS', 'EMAIL', 'NONE']),
  }),
});

export const TransferInitiatedEventSchema = BaseWebhookEventSchema.extend({
  event: z.literal('transfer.initiated'),
  data: z.object({
    transferId: TransferIdSchema,
    transferType: TransferTypeSchema,
    destination: TransferDestinationSchema,
    fallbackDestination: TransferDestinationSchema.optional(),
    contextSummary: z.string(),
    reason: z.string().optional(),
    status: TransferStatusSchema,
  }),
});

export const CallbackRequestedEventSchema = BaseWebhookEventSchema.extend({
  event: z.literal('callback.requested'),
  data: z.object({
    taskId: TaskIdSchema,
    callerName: z.string(),
    callerPhone: E164PhoneSchema,
    bestTimeToCall: z.string(),
    reason: z.string(),
    priority: CallbackPrioritySchema,
    assigneeRole: RecipientRoleSchema,
    assigneeId: z.string().cuid().optional(),
    dueDate: ISODateTimeSchema,
  }),
});

export const EmergencyEscalatedEventSchema = BaseWebhookEventSchema.extend({
  event: z.literal('emergency.escalated'),
  data: z.object({
    severity: EmergencySeveritySchema,
    trigger: EmergencyTriggerSchema,
    keyword: z.string(),
    callerName: z.string().nullable(),
    callerPhone: E164PhoneSchema,
    clientId: ClientIdSchema.nullable(),
    clientMrn: z.string().nullable(),
    conversationExcerpt: z.string(),
    escalationPath: z.string(),
    onCallClinicianId: ClinicianIdSchema,
    onCallClinicianName: z.string(),
    onCallPhone: E164PhoneSchema,
    transferred: z.boolean(),
    transferId: TransferIdSchema.optional(),
    tags: z.array(z.string()).optional(),
  }),
});

export const TransferEscalationEventSchema = BaseWebhookEventSchema.extend({
  event: z.literal('transfer.escalation'),
  data: z.object({
    transferId: TransferIdSchema,
    transferType: TransferTypeSchema,
    destination: TransferDestinationSchema,
    contextSummary: z.string(),
    reason: EscalationReasonSchema,
    clientId: ClientIdSchema.optional(),
    clientMrn: z.string().optional(),
    callerPhone: E164PhoneSchema,
  }),
});

export const ClinicalConcernEventSchema = BaseWebhookEventSchema.extend({
  event: z.literal('clinical.concern'),
  data: z.object({
    outcome: CallOutcomeSchema,
    summary: z.string(),
    clientId: ClientIdSchema,
    clientMrn: z.string(),
    clientName: z.string(),
    tags: z.array(z.string()),
    primaryClinicianId: ClinicianIdSchema,
    primaryClinicianName: z.string(),
    primaryClinicianEmail: EmailSchema,
  }),
});

export const WebhookEventSchema = z.union([
  LeadCapturedEventSchema,
  AppointmentBookedEventSchema,
  TransferInitiatedEventSchema,
  CallbackRequestedEventSchema,
  EmergencyEscalatedEventSchema,
  TransferEscalationEventSchema,
  ClinicalConcernEventSchema,
]);

export type WebhookEvent = z.infer<typeof WebhookEventSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

export function validateToolRequest(toolName: string, payload: unknown): { success: true; data: any } | { success: false; error: z.ZodError } {
  const schemas: Record<string, z.ZodSchema> = {
    lookup_client: LookupClientRequestSchema,
    capture_lead: CaptureLeadRequestSchema,
    create_or_request_appointment: CreateOrRequestAppointmentRequestSchema,
    transfer_call: TransferCallRequestSchema,
    send_message_or_callback_request: SendMessageOrCallbackRequestSchema,
    log_call_outcome: LogCallOutcomeRequestSchema,
    get_business_information: GetBusinessInformationRequestSchema,
  };

  const schema = schemas[toolName];
  if (!schema) {
    return { success: false, error: new z.ZodError([{ code: 'custom', message: `Unknown tool: ${toolName}`, path: [] }]) };
  }

  const result = schema.safeParse(payload);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

export function validateWebhookEvent(payload: unknown): { success: true; data: WebhookEvent } | { success: false; error: z.ZodError } {
  const result = WebhookEventSchema.safeParse(payload);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// ============================================================================
// Type Exports for Consumers (re-exported from individual declarations)
// ============================================================================

// Types are already exported at declaration site via `export type`
// This block intentionally left empty to avoid TS2484 conflicts