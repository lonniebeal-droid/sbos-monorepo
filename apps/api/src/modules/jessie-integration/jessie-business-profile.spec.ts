import { describe, expect, it } from 'vitest';
import { applyJessieProfile } from './jessie-business-profile';
import type { LookupClientResponseDto } from './dto/lookup-client.dto';

const base = {
  clientId: 'org-a', businessName: 'Test Business', bookingEnabled: false,
  greeting: 'Welcome', businessType: 'service_business', businessHours: {},
  services: [], faq: [], transferRules: {}, transferNumbers: [],
  afterHoursBehavior: 'callback', restrictedTopics: [], approvedClaims: [],
  customInstructions: '', bookingRules: {},
} as unknown as LookupClientResponseDto;

describe('tenant Jessie business profile', () => {
  it('preserves safe defaults for invalid profile data', () => {
    expect(applyJessieProfile(base, null)).toEqual(base);
    expect(applyJessieProfile(base, ['bad'])).toEqual(base);
  });
  it('loads only approved tenant fields and never claims confirmed booking', () => {
    const result = applyJessieProfile(base, {
      greeting: 'Hello there', services: ['Haircut', 'Consultation'],
      businessHours: { monday: '09:00-17:00' },
      faq: [{ question: 'Parking?', answer: 'Street' }],
      bookingEnabled: true, bookingRules: { autoConfirm: true },
      clientId: 'org-b', businessName: 'Attacker',
    });
    expect(result.services).toEqual(['Haircut', 'Consultation']);
    expect(result.businessHours.monday).toBe('09:00-17:00');
    expect(result.faq).toHaveLength(1);
    expect(result.bookingEnabled).toBe(false);
    expect(result.bookingRules).toEqual({});
    expect(result.clientId).toBe('org-a');
    expect(result.businessName).toBe('Test Business');
  });
});
