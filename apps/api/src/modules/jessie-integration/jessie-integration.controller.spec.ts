import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { JessieIntegrationController } from './jessie-integration.controller';
import { JessieIntegrationService } from './jessie-integration.service';
import { LookupIdentifierType } from './dto/lookup-client.dto';
import { CallOutcomeLeadQuality, CallOutcomeUrgency, CallOutcomeResolution } from './dto/call-outcome.dto';

const mockService: any = {
  lookupClient: vi.fn(),
  captureLead: vi.fn(),
  createAppointmentRequest: vi.fn(),
  transferCall: vi.fn(),
  sendMessageOrCallbackRequest: vi.fn(),
  logCallOutcome: vi.fn(),
  getBusinessInformation: vi.fn(),
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), verbose: vi.fn() },
  idempotencyCache: new Map(),
  prisma: {},
  audit: {},
};

const mockRequest = {
  agentOrganizationId: 'org_123',
};

describe('JessieIntegrationController', () => {
  let controller: JessieIntegrationController;

  beforeEach(() => {
    controller = new JessieIntegrationController(mockService);
    vi.clearAllMocks();
  });

  describe('lookupClient', () => {
    it('should return client configuration', async () => {
      const mockResult = {
        clientId: 'org_123',
        businessName: 'Test Center',
        businessType: 'service_business',
        greeting: 'Welcome',
        phone: '+15551234567',
        location: '123 Main St',
        businessHours: {},
        timezone: 'America/New_York',
        services: [],
        faq: [],
        transferRules: {},
        transferNumbers: [],
        leadCaptureFields: [],
        afterHoursBehavior: 'callback',
        bookingEnabled: false,
        bookingRules: {},
        emergencyRules: {},
        restrictedTopics: [],
        approvedClaims: [],
        customInstructions: '',
        clientStatus: 'active',
      };

      mockService.lookupClient.mockResolvedValue(mockResult);

      const dto = {
        identifierType: LookupIdentifierType.ORGANIZATION_ID,
        identifierValue: 'client_123',
        conversationId: 'conv_123',
        requestId: 'req_123',
      };

      const result = await controller.lookupClient(mockRequest as any, dto);

      expect(result).toEqual(mockResult);
      expect(mockService.lookupClient).toHaveBeenCalledWith('org_123', dto);
    });

    it('should propagate NotFoundException', async () => {
      mockService.lookupClient.mockRejectedValue(new NotFoundException('Not found'));

      const dto = {
        identifierType: LookupIdentifierType.ORGANIZATION_ID,
        identifierValue: 'nonexistent',
      };

      await expect(controller.lookupClient(mockRequest as any, dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('captureLead', () => {
    it('should return lead creation result', async () => {
      const mockResult = {
        leadId: 'lead_123',
        status: 'created',
        createdAt: '2026-08-29T10:00:00.000Z',
        requestId: 'req_123',
      };

      mockService.captureLead.mockResolvedValue(mockResult);

      const dto = {
        clientId: 'client_123',
        callerName: 'John Doe',
        callerPhone: '+15551234567',
        reasonForCall: 'Seeking therapy',
        conversationId: 'conv_123',
        requestId: 'req_123',
      };

      const result = await controller.captureLead(mockRequest as any, dto);

      expect(result).toEqual(mockResult);
      expect(mockService.captureLead).toHaveBeenCalledWith('org_123', dto);
    });
  });

  describe('createAppointmentRequest', () => {
    it('should return appointment request result', async () => {
      const mockResult = {
        appointmentRequestId: 'appt_123',
        status: 'requested',
        createdAt: '2026-08-29T10:00:00.000Z',
        requestId: 'req_123',
      };

      mockService.createAppointmentRequest.mockResolvedValue(mockResult);

      const dto = {
        clientId: 'client_123',
        callerName: 'John Doe',
        callerPhone: '+15551234567',
        service: 'individual_therapy',
        requestedDate: '2026-09-01',
        requestedTime: '10:00',
        timezone: 'America/Chicago',
        conversationId: 'conv_123',
        requestId: 'req_123',
      };

      const result = await controller.createAppointmentRequest(mockRequest as any, dto);

      expect(result).toEqual(mockResult);
    });
  });

  describe('transferCall', () => {
    it('should return transfer decision', async () => {
      const mockResult = {
        allowed: false,
        reason: 'No verified telephony transfer destination is configured for this organization',
        fallbackBehavior: 'callback',
        requestId: 'req_123',
      };

      mockService.transferCall.mockResolvedValue(mockResult);

      const dto = {
        clientId: 'client_123',
        intent: 'crisis_transfer',
        conversationId: 'conv_123',
        requestId: 'req_123',
      };

      const result = await controller.transferCall(mockRequest as any, dto);

      expect(result).toEqual(mockResult);
    });
  });

  describe('sendMessageOrCallbackRequest', () => {
    it('should return callback message result', async () => {
      const mockResult = {
        messageId: 'msg_123',
        status: 'request_recorded',
        createdAt: '2026-08-29T10:00:00.000Z',
        requestId: 'req_123',
      };

      mockService.sendMessageOrCallbackRequest.mockResolvedValue(mockResult);

      const dto = {
        clientId: 'client_123',
        callerName: 'John Doe',
        callerPhone: '+15551234567',
        message: 'Please call back',
        callbackRequested: true,
        conversationId: 'conv_123',
        requestId: 'req_123',
      };

      const result = await controller.sendMessageOrCallbackRequest(mockRequest as any, dto);

      expect(result).toEqual(mockResult);
    });
  });

  describe('logCallOutcome', () => {
    it('should return call outcome result', async () => {
      const mockResult = {
        outcomeId: 'outcome_123',
        status: 'logged',
        createdAt: '2026-08-29T10:00:00.000Z',
        requestId: 'req_123',
      };

      mockService.logCallOutcome.mockResolvedValue(mockResult);

      const dto = {
        clientId: 'client_123',
        businessName: 'Test Center',
        callerName: 'John Doe',
        callerPhone: '+15551234567',
        intent: 'therapy_inquiry',
        leadQuality: CallOutcomeLeadQuality.HIGH,
        urgency: CallOutcomeUrgency.NORMAL,
        appointmentRequested: false,
        appointmentCreated: false,
        transferRequested: false,
        transferCompleted: false,
        callbackRequested: true,
        resolution: CallOutcomeResolution.CALLBACK_SCHEDULED,
        followUpRequired: true,
        callSummary: 'Test summary',
        conversationId: 'conv_123',
        requestId: 'req_123',
      };

      const result = await controller.logCallOutcome(mockRequest as any, dto);

      expect(result).toEqual(mockResult);
    });
  });

  describe('getBusinessInformation', () => {
    it('should return business information', async () => {
      const mockResult = {
        clientId: 'org_123',
        businessName: 'Test Center',
        businessType: 'service_business',
        greeting: 'Welcome',
        phone: '+15551234567',
        location: '123 Main St',
        businessHours: {},
        timezone: 'America/New_York',
        services: [],
        faq: [],
        transferNumbers: {},
        afterHoursBehavior: 'callback',
        bookingEnabled: false,
        clientStatus: 'active',
      };

      mockService.getBusinessInformation.mockResolvedValue(mockResult);

      const dto = {
        clientId: 'client_123',
        conversationId: 'conv_123',
        requestId: 'req_123',
      };

      const result = await controller.getBusinessInformation(mockRequest as any, dto);

      expect(result).toEqual(mockResult);
    });

    it('should propagate NotFoundException', async () => {
      mockService.getBusinessInformation.mockRejectedValue(new NotFoundException('Not found'));

      const dto = {
        clientId: 'nonexistent',
      };

      await expect(controller.getBusinessInformation(mockRequest as any, dto)).rejects.toThrow(NotFoundException);
    });
  });
});
