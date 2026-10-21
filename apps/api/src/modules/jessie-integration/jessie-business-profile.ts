import type { LookupClientResponseDto } from './dto/lookup-client.dto';

// Only allow documented tenant settings. Never trust arbitrary JSON as tool output.
export function applyJessieProfile(
  base: LookupClientResponseDto,
  value: unknown,
): LookupClientResponseDto {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base;
  const p = value as Record<string, unknown>;
  const string = (v: unknown, max = 300) => typeof v === 'string' ? v.trim().slice(0, max) : '';
  const strings = (v: unknown, max = 30) => Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string').slice(0, max).map(x => x.trim().slice(0, 160)).filter(Boolean)
    : [];
  const record = (v: unknown, max = 30): Record<string, string> => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    return Object.fromEntries(Object.entries(v).slice(0, max)
      .filter(([k, x]) => Boolean(string(k, 80)) && typeof x === 'string')
      .map(([k, x]) => [string(k, 80), string(x, 300)]));
  };
  const faq = Array.isArray(p.faq) ? p.faq.slice(0, 30).flatMap((x) => {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return [];
    const item = x as Record<string, unknown>;
    const question = string(item.question, 300), answer = string(item.answer, 800);
    return question && answer ? [{ question, answer }] : [];
  }) : base.faq;
  return {
    ...base,
    greeting: string(p.greeting, 500) || base.greeting,
    businessType: string(p.businessType, 80) || base.businessType,
    businessHours: p.businessHours === undefined ? base.businessHours : record(p.businessHours, 14),
    services: p.services === undefined ? base.services : strings(p.services, 60),
    faq,
    transferRules: p.transferRules === undefined ? base.transferRules : record(p.transferRules),
    transferNumbers: p.transferNumbers === undefined ? base.transferNumbers : strings(p.transferNumbers).filter(n => /^\+[1-9]\d{7,14}$/.test(n)),
    afterHoursBehavior: ['callback', 'voicemail', 'closed'].includes(String(p.afterHoursBehavior))
      ? String(p.afterHoursBehavior) : base.afterHoursBehavior,
    restrictedTopics: p.restrictedTopics === undefined ? base.restrictedTopics : strings(p.restrictedTopics),
    approvedClaims: p.approvedClaims === undefined ? base.approvedClaims : strings(p.approvedClaims),
    customInstructions: string(p.customInstructions, 2000) || base.customInstructions,
    // A request for an appointment is not a confirmed calendar booking.
    // This stays false until a separate real scheduling integration is verified.
    bookingEnabled: false,
    bookingRules: {},
  };
}
