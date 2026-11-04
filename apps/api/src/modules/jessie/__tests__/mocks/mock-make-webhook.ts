import { MakeEventDto } from '../../dto/jessie-integration.dto';

export interface CapturedMakeEvent {
  event: MakeEventDto;
  receivedAt: Date;
}

export class MockMakeWebhookReceiver {
  private events: CapturedMakeEvent[] = [];
  private handlers: Map<string, (event: MakeEventDto) => Promise<void>> = new Map();

  capture(event: MakeEventDto): void {
    this.events.push({
      event,
      receivedAt: new Date(),
    });
  }

  getAllEvents(): CapturedMakeEvent[] {
    return [...this.events];
  }

  getEventsByType(eventType: string): CapturedMakeEvent[] {
    return this.events.filter((e) => e.event.event_type === eventType);
  }

  getLatestEvent(eventType?: string): CapturedMakeEvent | undefined {
    if (eventType) {
      const filtered = this.getEventsByType(eventType);
      return filtered[filtered.length - 1];
    }
    return this.events[this.events.length - 1];
  }

  getEventCount(eventType?: string): number {
    if (eventType) {
      return this.getEventsByType(eventType).length;
    }
    return this.events.length;
  }

  clear(): void {
    this.events = [];
  }

  registerHandler(eventType: string, handler: (event: MakeEventDto) => Promise<void>): void {
    this.handlers.set(eventType, handler);
  }

  async processEvent(event: MakeEventDto): Promise<void> {
    this.capture(event);
    const handler = this.handlers.get(event.event_type);
    if (handler) {
      await handler(event);
    }
  }

  assertEventEmitted(
    eventType: string,
    options?: {
      minCount?: number;
      maxCount?: number;
      payloadMatcher?: (payload: Record<string, unknown>) => boolean;
    }
  ): CapturedMakeEvent[] {
    const events = this.getEventsByType(eventType);
    const count = events.length;

    if (options?.minCount !== undefined && count < options.minCount) {
      throw new Error(
        `Expected at least ${options.minCount} events of type "${eventType}", but got ${count}`
      );
    }

    if (options?.maxCount !== undefined && count > options.maxCount) {
      throw new Error(
        `Expected at most ${options.maxCount} events of type "${eventType}", but got ${count}`
      );
    }

    if (options?.payloadMatcher) {
      const matching = events.filter((e) => options.payloadMatcher!(e.event.payload ?? {}));
      if (matching.length === 0) {
        throw new Error(
          `No events of type "${eventType}" matched the payload matcher`
        );
      }
    }

    return events;
  }

  assertNoEventEmitted(eventType: string): void {
    const events = this.getEventsByType(eventType);
    if (events.length > 0) {
      throw new Error(`Expected no events of type "${eventType}", but got ${events.length}`);
    }
  }

  assertExactlyOneEvent(eventType: string): CapturedMakeEvent {
    const events = this.getEventsByType(eventType);
    if (events.length !== 1) {
      throw new Error(`Expected exactly 1 event of type "${eventType}", but got ${events.length}`);
    }
    return events[0];
  }
}

export function createMockMakeWebhookReceiver(): MockMakeWebhookReceiver {
  return new MockMakeWebhookReceiver();
}

export function makeEventShapeValidator(event: MakeEventDto): void {
  if (!event) throw new Error('Event is undefined');
  if (!event.event_id) throw new Error('event_id is undefined');
  if (!/^evt-[0-9a-f-]+$/i.test(event.event_id)) throw new Error('event_id does not match pattern');
  if (!event.request_id) throw new Error('request_id is undefined');
  if (!/^req-[0-9a-f-]+$/i.test(event.request_id)) throw new Error('request_id does not match pattern');
  if (!event.conversation_id) throw new Error('conversation_id is undefined');
  if (!event.client_id) throw new Error('client_id is undefined');
  if (!event.organization_id) throw new Error('organization_id is undefined');
  if (!/^org-[0-9a-f-]+$/i.test(event.organization_id)) throw new Error('organization_id does not match pattern');
  if (typeof event.event_type !== 'string') throw new Error('event_type is not a string');
  const validTypes = [
    'lookup_client',
    'capture_lead',
    'create_or_request_appointment',
    'transfer_call',
    'send_message_or_callback_request',
    'log_call_outcome',
    'get_business_information',
  ];
  if (!validTypes.includes(event.event_type)) throw new Error(`Invalid event_type: ${event.event_type}`);
  if (!event.timestamp) throw new Error('timestamp is undefined');
  if (new Date(event.timestamp).toISOString() !== event.timestamp) throw new Error('timestamp is not valid ISO string');
  if (event.payload !== undefined && typeof event.payload !== 'object') throw new Error('payload is not an object');
}