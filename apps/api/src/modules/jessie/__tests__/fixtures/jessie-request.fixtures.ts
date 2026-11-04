import {
  LookupClientRequestDto,
  CaptureLeadRequestDto,
  CreateOrRequestAppointmentRequestDto,
  TransferCallRequestDto,
  SendMessageOrCallbackRequestDto,
  LogCallOutcomeRequestDto,
  CallOutcomeEnum,
  TransferTargetEnum,
} from '../../dto/jessie-integration.dto';

export const VALID_ORG_ID = 'org-550e8400-e29b-41d4-a716-446655440000';
export const VALID_CLIENT_ID = 'client-550e8400-e29b-41d4-a716-446655440000';
export const VALID_CONVERSATION_ID = 'conv-550e8400-e29b-41d4-a716-446655440000';
export const VALID_CLINICIAN_ID = 'clin-550e8400-e29b-41d4-a716-446655440000';
export const VALID_OTHER_ORG_ID = 'org-550e8400-e29b-41d4-a716-446655440001';
export const VALID_SERVICE_SECRET = 'test-service-secret-12345';
export const VALID_OTHER_SERVICE_SECRET = 'other-service-secret-67890';

export const IDEMPOTENCY_KEY_PREFIX = 'idem-';
export const REQUEST_ID_PREFIX = 'req-';
export const EVENT_ID_PREFIX = 'evt-';

export function generateIdempotencyKey(suffix: string): string {
  return `${IDEMPOTENCY_KEY_PREFIX}${suffix}`;
}

export function generateRequestId(suffix: string): string {
  return `${REQUEST_ID_PREFIX}${suffix}`;
}

export function generateEventId(suffix: string): string {
  return `${EVENT_ID_PREFIX}${suffix}`;
}

export const lookupClientFixtures = {
  valid: (overrides: Partial<LookupClientRequestDto> = {}): LookupClientRequestDto => ({
    clientId: VALID_CLIENT_ID,
    ...overrides,
  }),

  withMrn: (mrn: string = 'MRN-12345'): LookupClientRequestDto => ({
    clientId: VALID_CLIENT_ID,
    mrn,
  }),

  withPhone: (phone: string = '+15551234567'): LookupClientRequestDto => ({
    clientId: VALID_CLIENT_ID,
    phone,
  }),

  missingClientId: (): Omit<LookupClientRequestDto, 'clientId'> => ({}),

  invalidClientId: (): LookupClientRequestDto => ({
    clientId: 'not-a-uuid',
  }),

  wrongTenantClientId: (): LookupClientRequestDto => ({
    clientId: 'client-550e8400-e29b-41d4-a716-446655440001',
  }),
};

export const captureLeadFixtures = {
  valid: (overrides: Partial<CaptureLeadRequestDto> = {}): CaptureLeadRequestDto => ({
    firstName: 'Jane',
    lastName: 'Smith',
    idempotencyKey: generateIdempotencyKey('capture-lead-001'),
    ...overrides,
  }),

  withPhone: (phone: string = '+15559876543'): CaptureLeadRequestDto => ({
    firstName: 'Jane',
    lastName: 'Smith',
    phone,
    idempotencyKey: generateIdempotencyKey('capture-lead-phone'),
  }),

  withEmail: (email: string = 'jane.smith@example.com'): CaptureLeadRequestDto => ({
    firstName: 'Jane',
    lastName: 'Smith',
    email,
    idempotencyKey: generateIdempotencyKey('capture-lead-email'),
  }),

  withReason: (reason: string = 'Interested in anxiety therapy'): CaptureLeadRequestDto => ({
    firstName: 'Jane',
    lastName: 'Smith',
    reason,
    idempotencyKey: generateIdempotencyKey('capture-lead-reason'),
  }),

  withSource: (source: string = 'WEB_FORM'): CaptureLeadRequestDto => ({
    firstName: 'Jane',
    lastName: 'Smith',
    source,
    idempotencyKey: generateIdempotencyKey('capture-lead-source'),
  }),

  missingFirstName: (): Omit<CaptureLeadRequestDto, 'firstName'> => ({
    lastName: 'Smith',
    idempotencyKey: generateIdempotencyKey('missing-firstname'),
  }),

  missingLastName: (): Omit<CaptureLeadRequestDto, 'lastName'> => ({
    firstName: 'Jane',
    idempotencyKey: generateIdempotencyKey('missing-lastname'),
  }),

  missingIdempotencyKey: (): Omit<CaptureLeadRequestDto, 'idempotencyKey'> => ({
    firstName: 'Jane',
    lastName: 'Smith',
  }),

  emptyFirstName: (): CaptureLeadRequestDto => ({
    firstName: '',
    lastName: 'Smith',
    idempotencyKey: generateIdempotencyKey('empty-firstname'),
  }),

  emptyLastName: (): CaptureLeadRequestDto => ({
    firstName: 'Jane',
    lastName: '',
    idempotencyKey: generateIdempotencyKey('empty-lastname'),
  }),

  duplicateIdempotencyKey: (key: string = generateIdempotencyKey('duplicate')): CaptureLeadRequestDto => ({
    firstName: 'Jane',
    lastName: 'Smith',
    idempotencyKey: key,
  }),

  conflictingResourceType: (key: string = generateIdempotencyKey('conflict')): CaptureLeadRequestDto => ({
    firstName: 'Jane',
    lastName: 'Smith',
    idempotencyKey: key,
  }),
};

export const createOrRequestAppointmentFixtures = {
  valid: (overrides: Partial<CreateOrRequestAppointmentRequestDto> = {}): CreateOrRequestAppointmentRequestDto => ({
    clientId: VALID_CLIENT_ID,
    type: 'INDIVIDUAL',
    preferredStartTime: '2026-09-15T10:00:00.000Z',
    idempotencyKey: generateIdempotencyKey('appointment-001'),
    ...overrides,
  }),

  withDuration: (durationMinutes: number = 60): CreateOrRequestAppointmentRequestDto => ({
    clientId: VALID_CLIENT_ID,
    type: 'INDIVIDUAL',
    preferredStartTime: '2026-09-15T10:00:00.000Z',
    durationMinutes: String(durationMinutes),
    idempotencyKey: generateIdempotencyKey('appointment-duration'),
  }),

  withPreferredClinician: (clinicianId: string = VALID_CLINICIAN_ID): CreateOrRequestAppointmentRequestDto => ({
    clientId: VALID_CLIENT_ID,
    type: 'INDIVIDUAL',
    preferredStartTime: '2026-09-15T10:00:00.000Z',
    preferredClinicianId: clinicianId,
    idempotencyKey: generateIdempotencyKey('appointment-clinician'),
  }),

  withReason: (reason: string = 'ANXIETY_INTAKE'): CreateOrRequestAppointmentRequestDto => ({
    clientId: VALID_CLIENT_ID,
    type: 'INDIVIDUAL',
    preferredStartTime: '2026-09-15T10:00:00.000Z',
    reason,
    idempotencyKey: generateIdempotencyKey('appointment-reason'),
  }),

  intakeType: (): CreateOrRequestAppointmentRequestDto => ({
    clientId: VALID_CLIENT_ID,
    type: 'INTAKE',
    preferredStartTime: '2026-09-15T10:00:00.000Z',
    idempotencyKey: generateIdempotencyKey('appointment-intake'),
  }),

  groupType: (): CreateOrRequestAppointmentRequestDto => ({
    clientId: VALID_CLIENT_ID,
    type: 'GROUP',
    preferredStartTime: '2026-09-15T10:00:00.000Z',
    idempotencyKey: generateIdempotencyKey('appointment-group'),
  }),

  telehealthType: (): CreateOrRequestAppointmentRequestDto => ({
    clientId: VALID_CLIENT_ID,
    type: 'TELEHEALTH',
    preferredStartTime: '2026-09-15T10:00:00.000Z',
    idempotencyKey: generateIdempotencyKey('appointment-telehealth'),
  }),

  missingClientId: (): Omit<CreateOrRequestAppointmentRequestDto, 'clientId'> => ({
    type: 'INDIVIDUAL',
    preferredStartTime: '2026-09-15T10:00:00.000Z',
    idempotencyKey: generateIdempotencyKey('missing-clientid'),
  }),

  missingType: (): Omit<CreateOrRequestAppointmentRequestDto, 'type'> => ({
    clientId: VALID_CLIENT_ID,
    preferredStartTime: '2026-09-15T10:00:00.000Z',
    idempotencyKey: generateIdempotencyKey('missing-type'),
  }),

  missingPreferredStartTime: (): Omit<CreateOrRequestAppointmentRequestDto, 'preferredStartTime'> => ({
    clientId: VALID_CLIENT_ID,
    type: 'INDIVIDUAL',
    idempotencyKey: generateIdempotencyKey('missing-starttime'),
  }),

  missingIdempotencyKey: (): Omit<CreateOrRequestAppointmentRequestDto, 'idempotencyKey'> => ({
    clientId: VALID_CLIENT_ID,
    type: 'INDIVIDUAL',
    preferredStartTime: '2026-09-15T10:00:00.000Z',
  }),

  invalidClientId: (): CreateOrRequestAppointmentRequestDto => ({
    clientId: 'not-a-uuid',
    type: 'INDIVIDUAL',
    preferredStartTime: '2026-09-15T10:00:00.000Z',
    idempotencyKey: generateIdempotencyKey('invalid-clientid'),
  }),

  invalidPreferredStartTime: (): CreateOrRequestAppointmentRequestDto => ({
    clientId: VALID_CLIENT_ID,
    type: 'INDIVIDUAL',
    preferredStartTime: 'not-a-date',
    idempotencyKey: generateIdempotencyKey('invalid-starttime'),
  }),

  wrongTenantClientId: (): CreateOrRequestAppointmentRequestDto => ({
    clientId: 'client-550e8400-e29b-41d4-a716-446655440001',
    type: 'INDIVIDUAL',
    preferredStartTime: '2026-09-15T10:00:00.000Z',
    idempotencyKey: generateIdempotencyKey('wrong-tenant-client'),
  }),

  wrongTenantClinicianId: (): CreateOrRequestAppointmentRequestDto => ({
    clientId: VALID_CLIENT_ID,
    type: 'INDIVIDUAL',
    preferredStartTime: '2026-09-15T10:00:00.000Z',
    preferredClinicianId: 'clin-550e8400-e29b-41d4-a716-446655440001',
    idempotencyKey: generateIdempotencyKey('wrong-tenant-clinician'),
  }),

  duplicateIdempotencyKey: (key: string = generateIdempotencyKey('duplicate-appointment')): CreateOrRequestAppointmentRequestDto => ({
    clientId: VALID_CLIENT_ID,
    type: 'INDIVIDUAL',
    preferredStartTime: '2026-09-15T10:00:00.000Z',
    idempotencyKey: key,
  }),

  conflictingResourceType: (key: string = generateIdempotencyKey('conflict-appointment')): CreateOrRequestAppointmentRequestDto => ({
    clientId: VALID_CLIENT_ID,
    type: 'INDIVIDUAL',
    preferredStartTime: '2026-09-15T10:00:00.000Z',
    idempotencyKey: key,
  }),
};

export const transferCallFixtures = {
  valid: (overrides: Partial<TransferCallRequestDto> = {}): TransferCallRequestDto => ({
    conversationId: VALID_CONVERSATION_ID,
    target: TransferTargetEnum.HUMAN_AGENT,
    ...overrides,
  }),

  humanAgent: (): TransferCallRequestDto => ({
    conversationId: VALID_CONVERSATION_ID,
    target: TransferTargetEnum.HUMAN_AGENT,
    reason: 'Client requested human operator',
  }),

  voicemail: (): TransferCallRequestDto => ({
    conversationId: VALID_CONVERSATION_ID,
    target: TransferTargetEnum.VOICEMAIL,
    reason: 'After hours',
  }),

  schedulingQueue: (): TransferCallRequestDto => ({
    conversationId: VALID_CONVERSATION_ID,
    target: TransferTargetEnum.SCHEDULING_QUEUE,
    reason: 'Client wants to schedule',
  }),

  crisisLine: (): TransferCallRequestDto => ({
    conversationId: VALID_CONVERSATION_ID,
    target: TransferTargetEnum.CRISIS_LINE,
    reason: 'Client in crisis',
  }),

  withTargetAgent: (agentId: string = VALID_CLINICIAN_ID): TransferCallRequestDto => ({
    conversationId: VALID_CONVERSATION_ID,
    target: TransferTargetEnum.HUMAN_AGENT,
    targetAgentId: agentId,
    reason: 'Specific agent requested',
  }),

  missingConversationId: (): Omit<TransferCallRequestDto, 'conversationId'> => ({
    target: TransferTargetEnum.HUMAN_AGENT,
  }),

  missingTarget: (): Omit<TransferCallRequestDto, 'target'> => ({
    conversationId: VALID_CONVERSATION_ID,
  }),

  invalidConversationId: (): TransferCallRequestDto => ({
    conversationId: 'not-a-uuid',
    target: TransferTargetEnum.HUMAN_AGENT,
  }),

  invalidTarget: (): TransferCallRequestDto => ({
    conversationId: VALID_CONVERSATION_ID,
    target: 'INVALID_TARGET' as any,
  }),

  wrongTenantConversationId: (): TransferCallRequestDto => ({
    conversationId: 'conv-550e8400-e29b-41d4-a716-446655440001',
    target: TransferTargetEnum.HUMAN_AGENT,
  }),
};

export const sendMessageOrCallbackFixtures = {
  valid: (overrides: Partial<SendMessageOrCallbackRequestDto> = {}): SendMessageOrCallbackRequestDto => ({
    clientId: VALID_CLIENT_ID,
    type: 'CALLBACK_REQUEST',
    idempotencyKey: generateIdempotencyKey('callback-001'),
    ...overrides,
  }),

  sms: (contactValue: string = '+15551234567', message: string = 'Test SMS'): SendMessageOrCallbackRequestDto => ({
    clientId: VALID_CLIENT_ID,
    type: 'SMS',
    contactValue,
    message,
    idempotencyKey: generateIdempotencyKey('sms-001'),
  }),

  email: (contactValue: string = 'test@example.com', message: string = 'Test email'): SendMessageOrCallbackRequestDto => ({
    clientId: VALID_CLIENT_ID,
    type: 'EMAIL',
    contactValue,
    message,
    idempotencyKey: generateIdempotencyKey('email-001'),
  }),

  callbackRequest: (message: string = 'Please call me back at 2pm', preferredCallbackTime: string = '2026-09-15T14:00:00.000Z'): SendMessageOrCallbackRequestDto => ({
    clientId: VALID_CLIENT_ID,
    type: 'CALLBACK_REQUEST',
    message,
    preferredCallbackTime,
    idempotencyKey: generateIdempotencyKey('callback-request-001'),
  }),

  internalNote: (message: string = 'Internal note for team'): SendMessageOrCallbackRequestDto => ({
    clientId: VALID_CLIENT_ID,
    type: 'INTERNAL_NOTE',
    message,
    idempotencyKey: generateIdempotencyKey('internal-note-001'),
  }),

  missingClientId: (): Omit<SendMessageOrCallbackRequestDto, 'clientId'> => ({
    type: 'CALLBACK_REQUEST',
    idempotencyKey: generateIdempotencyKey('missing-clientid'),
  }),

  missingType: (): Omit<SendMessageOrCallbackRequestDto, 'type'> => ({
    clientId: VALID_CLIENT_ID,
    idempotencyKey: generateIdempotencyKey('missing-type'),
  }),

  missingIdempotencyKey: (): Omit<SendMessageOrCallbackRequestDto, 'idempotencyKey'> => ({
    clientId: VALID_CLIENT_ID,
    type: 'CALLBACK_REQUEST',
  }),

  invalidClientId: (): SendMessageOrCallbackRequestDto => ({
    clientId: 'not-a-uuid',
    type: 'CALLBACK_REQUEST',
    idempotencyKey: generateIdempotencyKey('invalid-clientid'),
  }),

  invalidType: (): SendMessageOrCallbackRequestDto => ({
    clientId: VALID_CLIENT_ID,
    type: 'INVALID_TYPE' as any,
    idempotencyKey: generateIdempotencyKey('invalid-type'),
  }),

  wrongTenantClientId: (): SendMessageOrCallbackRequestDto => ({
    clientId: 'client-550e8400-e29b-41d4-a716-446655440001',
    type: 'CALLBACK_REQUEST',
    idempotencyKey: generateIdempotencyKey('wrong-tenant-client'),
  }),

  duplicateIdempotencyKey: (key: string = generateIdempotencyKey('duplicate-callback')): SendMessageOrCallbackRequestDto => ({
    clientId: VALID_CLIENT_ID,
    type: 'CALLBACK_REQUEST',
    idempotencyKey: key,
  }),

  conflictingResourceType: (key: string = generateIdempotencyKey('conflict-callback')): SendMessageOrCallbackRequestDto => ({
    clientId: VALID_CLIENT_ID,
    type: 'CALLBACK_REQUEST',
    idempotencyKey: key,
  }),
};

export const logCallOutcomeFixtures = {
  valid: (overrides: Partial<LogCallOutcomeRequestDto> = {}): LogCallOutcomeRequestDto => ({
    conversationId: VALID_CONVERSATION_ID,
    outcome: CallOutcomeEnum.COMPLETED,
    idempotencyKey: generateIdempotencyKey('call-log-001'),
    ...overrides,
  }),

  completed: (): LogCallOutcomeRequestDto => ({
    conversationId: VALID_CONVERSATION_ID,
    outcome: CallOutcomeEnum.COMPLETED,
    durationSeconds: '420',
    summary: 'Client scheduled follow-up appointment',
    recordingId: 'rec-550e8400-e29b-41d4-a716-446655440000',
    idempotencyKey: generateIdempotencyKey('call-log-completed'),
  }),

  noAnswer: (): LogCallOutcomeRequestDto => ({
    conversationId: VALID_CONVERSATION_ID,
    outcome: CallOutcomeEnum.NO_ANSWER,
    durationSeconds: '30',
    idempotencyKey: generateIdempotencyKey('call-log-no-answer'),
  }),

  busy: (): LogCallOutcomeRequestDto => ({
    conversationId: VALID_CONVERSATION_ID,
    outcome: CallOutcomeEnum.BUSY,
    durationSeconds: '15',
    idempotencyKey: generateIdempotencyKey('call-log-busy'),
  }),

  failed: (): LogCallOutcomeRequestDto => ({
    conversationId: VALID_CONVERSATION_ID,
    outcome: CallOutcomeEnum.FAILED,
    durationSeconds: '5',
    summary: 'Connection failed',
    idempotencyKey: generateIdempotencyKey('call-log-failed'),
  }),

  voicemail: (): LogCallOutcomeRequestDto => ({
    conversationId: VALID_CONVERSATION_ID,
    outcome: CallOutcomeEnum.VOICEMAIL,
    durationSeconds: '60',
    summary: 'Left voicemail',
    idempotencyKey: generateIdempotencyKey('call-log-voicemail'),
  }),

  callbackRequested: (): LogCallOutcomeRequestDto => ({
    conversationId: VALID_CONVERSATION_ID,
    outcome: CallOutcomeEnum.CALLBACK_REQUESTED,
    durationSeconds: '120',
    summary: 'Client requested callback',
    idempotencyKey: generateIdempotencyKey('call-log-callback-requested'),
  }),

  transferred: (): LogCallOutcomeRequestDto => ({
    conversationId: VALID_CONVERSATION_ID,
    outcome: CallOutcomeEnum.TRANSFERRED,
    durationSeconds: '180',
    summary: 'Transferred to human agent',
    idempotencyKey: generateIdempotencyKey('call-log-transferred'),
  }),

  missingConversationId: (): Omit<LogCallOutcomeRequestDto, 'conversationId'> => ({
    outcome: CallOutcomeEnum.COMPLETED,
    idempotencyKey: generateIdempotencyKey('missing-conversationid'),
  }),

  missingOutcome: (): Omit<LogCallOutcomeRequestDto, 'outcome'> => ({
    conversationId: VALID_CONVERSATION_ID,
    idempotencyKey: generateIdempotencyKey('missing-outcome'),
  }),

  missingIdempotencyKey: (): Omit<LogCallOutcomeRequestDto, 'idempotencyKey'> => ({
    conversationId: VALID_CONVERSATION_ID,
    outcome: CallOutcomeEnum.COMPLETED,
  }),

  invalidConversationId: (): LogCallOutcomeRequestDto => ({
    conversationId: 'not-a-uuid',
    outcome: CallOutcomeEnum.COMPLETED,
    idempotencyKey: generateIdempotencyKey('invalid-conversationid'),
  }),

  invalidOutcome: (): LogCallOutcomeRequestDto => ({
    conversationId: VALID_CONVERSATION_ID,
    outcome: 'INVALID_OUTCOME' as any,
    idempotencyKey: generateIdempotencyKey('invalid-outcome'),
  }),

  wrongTenantConversationId: (): LogCallOutcomeRequestDto => ({
    conversationId: 'conv-550e8400-e29b-41d4-a716-446655440001',
    outcome: CallOutcomeEnum.COMPLETED,
    idempotencyKey: generateIdempotencyKey('wrong-tenant-conversation'),
  }),

  duplicateIdempotencyKey: (key: string = generateIdempotencyKey('duplicate-call-log')): LogCallOutcomeRequestDto => ({
    conversationId: VALID_CONVERSATION_ID,
    outcome: CallOutcomeEnum.COMPLETED,
    idempotencyKey: key,
  }),

  conflictingResourceType: (key: string = generateIdempotencyKey('conflict-call-log')): LogCallOutcomeRequestDto => ({
    conversationId: VALID_CONVERSATION_ID,
    outcome: CallOutcomeEnum.COMPLETED,
    idempotencyKey: key,
  }),
};

export const getBusinessInformationFixtures = {
  valid: () => ({}),

  wrongTenant: () => ({}),
};

export const elevenLabsStyleFixtures = {
  captureLead: {
    conversation_id: VALID_CONVERSATION_ID,
    client_id: VALID_CLIENT_ID,
    organization_id: VALID_ORG_ID,
    event_type: 'capture_lead',
    payload: {
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '+15559876543',
      email: 'jane.smith@example.com',
      reason: 'Interested in anxiety therapy',
      source: 'ELEVENLABS_WEBHOOK',
      idempotencyKey: generateIdempotencyKey('elevenlabs-capture-lead'),
    },
  },

  createAppointment: {
    conversation_id: VALID_CONVERSATION_ID,
    client_id: VALID_CLIENT_ID,
    organization_id: VALID_ORG_ID,
    event_type: 'create_or_request_appointment',
    payload: {
      clientId: VALID_CLIENT_ID,
      type: 'INDIVIDUAL',
      preferredStartTime: '2026-09-15T10:00:00.000Z',
      durationMinutes: '60',
      preferredClinicianId: VALID_CLINICIAN_ID,
      reason: 'ANXIETY_INTAKE',
      idempotencyKey: generateIdempotencyKey('elevenlabs-appointment'),
    },
  },

  transferCall: {
    conversation_id: VALID_CONVERSATION_ID,
    client_id: VALID_CLIENT_ID,
    organization_id: VALID_ORG_ID,
    event_type: 'transfer_call',
    payload: {
      conversationId: VALID_CONVERSATION_ID,
      target: TransferTargetEnum.HUMAN_AGENT,
      reason: 'Client requested human operator',
      targetAgentId: VALID_CLINICIAN_ID,
    },
  },

  sendMessage: {
    conversation_id: VALID_CONVERSATION_ID,
    client_id: VALID_CLIENT_ID,
    organization_id: VALID_ORG_ID,
    event_type: 'send_message_or_callback_request',
    payload: {
      clientId: VALID_CLIENT_ID,
      type: 'SMS',
      message: 'Your appointment is confirmed',
      contactValue: '+15551234567',
      idempotencyKey: generateIdempotencyKey('elevenlabs-sms'),
    },
  },

  logCallOutcome: {
    conversation_id: VALID_CONVERSATION_ID,
    client_id: VALID_CLIENT_ID,
    organization_id: VALID_ORG_ID,
    event_type: 'log_call_outcome',
    payload: {
      conversationId: VALID_CONVERSATION_ID,
      outcome: CallOutcomeEnum.COMPLETED,
      durationSeconds: '420',
      summary: 'Successful intake call',
      recordingId: 'rec-550e8400-e29b-41d4-a716-446655440000',
      idempotencyKey: generateIdempotencyKey('elevenlabs-call-log'),
    },
  },

  lookupClient: {
    conversation_id: 'lookup-client',
    client_id: VALID_CLIENT_ID,
    organization_id: VALID_ORG_ID,
    event_type: 'lookup_client',
    payload: {
      clientId: VALID_CLIENT_ID,
      mrn: 'MRN-12345',
    },
  },

  getBusinessInformation: {
    conversation_id: 'get-business-info',
    client_id: 'none',
    organization_id: VALID_ORG_ID,
    event_type: 'get_business_information',
    payload: {},
  },
};

export const authFixtures = {
  validHeaders: (orgId: string = VALID_ORG_ID, secret: string = VALID_SERVICE_SECRET) => ({
    authorization: `Bearer ${secret}`,
    'x-organization-id': orgId,
  }),

  missingAuth: () => ({}),

  missingAuthHeader: (orgId: string = VALID_ORG_ID) => ({
    'x-organization-id': orgId,
  }),

  missingOrgHeader: (secret: string = VALID_SERVICE_SECRET) => ({
    authorization: `Bearer ${secret}`,
  }),

  invalidScheme: (orgId: string = VALID_ORG_ID, secret: string = VALID_SERVICE_SECRET) => ({
    authorization: `Basic ${secret}`,
    'x-organization-id': orgId,
  }),

  invalidToken: (orgId: string = VALID_ORG_ID) => ({
    authorization: `Bearer invalid-token`,
    'x-organization-id': orgId,
  }),

  invalidOrg: (secret: string = VALID_SERVICE_SECRET) => ({
    authorization: `Bearer ${secret}`,
    'x-organization-id': 'org-invalid',
  }),

  inactiveOrg: (secret: string = VALID_SERVICE_SECRET) => ({
    authorization: `Bearer ${secret}`,
    'x-organization-id': 'org-inactive',
  }),

  wrongTenant: (secret: string = VALID_SERVICE_SECRET) => ({
    authorization: `Bearer ${secret}`,
    'x-organization-id': VALID_OTHER_ORG_ID,
  }),

  otherSecret: (orgId: string = VALID_ORG_ID) => ({
    authorization: `Bearer ${VALID_OTHER_SERVICE_SECRET}`,
    'x-organization-id': orgId,
  }),
};

export const makeEventFixtures = {
  expectedEventTypes: [
    'lookup_client',
    'capture_lead',
    'create_or_request_appointment',
    'transfer_call',
    'send_message_or_callback_request',
    'log_call_outcome',
    'get_business_information',
  ] as const,

  validateMakeEvent: (event: any, expectedType: string) => {
    if (!event) throw new Error('Event is undefined');
    if (!event.event_id) throw new Error('event_id is undefined');
    if (!/^evt-/.test(event.event_id)) throw new Error('event_id does not match pattern');
    if (!event.request_id) throw new Error('request_id is undefined');
    if (!/^req-/.test(event.request_id)) throw new Error('request_id does not match pattern');
    if (!event.conversation_id) throw new Error('conversation_id is undefined');
    if (!event.client_id) throw new Error('client_id is undefined');
    if (!event.organization_id) throw new Error('organization_id is undefined');
    if (!/^org-/.test(event.organization_id)) throw new Error('organization_id does not match pattern');
    if (event.event_type !== expectedType) throw new Error(`event_type mismatch: expected ${expectedType}, got ${event.event_type}`);
    if (!event.timestamp) throw new Error('timestamp is undefined');
    if (new Date(event.timestamp).toISOString() !== event.timestamp) throw new Error('timestamp is not valid ISO string');
  },
};