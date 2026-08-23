import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

function fileHasDecorator(path: string, decorator: string) {
  const src = readFileSync(path, 'utf8');
  return src.includes(decorator);
}

describe('Controller Roles (source checks)', () => {
  it('clients.create should require FRONT_DESK', () => {
    expect(
      fileHasDecorator(
        'src/modules/clients/clients.controller.ts',
        "@Roles(Role.FRONT_DESK)",
      ),
    ).toBe(true);
  });

  it('clients.update should require CLINICIAN', () => {
    expect(
      fileHasDecorator(
        'src/modules/clients/clients.controller.ts',
        "@Roles(Role.CLINICIAN)",
      ),
    ).toBe(true);
  });

  it('appointments.create should require FRONT_DESK', () => {
    expect(
      fileHasDecorator(
        'src/modules/appointments/appointments.controller.ts',
        "@Roles(Role.FRONT_DESK)",
      ),
    ).toBe(true);
  });

  it('notes.create should require CLINICIAN', () => {
    expect(
      fileHasDecorator('src/modules/notes/notes.controller.ts', "@Roles(Role.CLINICIAN)"),
    ).toBe(true);
  });

  it('billing.createClaim should require BILLING', () => {
    expect(
      fileHasDecorator('src/modules/billing/billing.controller.ts', "@Roles(Role.BILLING)"),
    ).toBe(true);
  });

  it('documents.create should require CLINICIAN', () => {
    expect(
      fileHasDecorator('src/modules/documents/documents.controller.ts', "@Roles(Role.CLINICIAN)"),
    ).toBe(true);
  });

  it('treatment-plans.create should require CLINICIAN', () => {
    expect(
      fileHasDecorator('src/modules/treatment-plans/treatment-plans.controller.ts', "@Roles(Role.CLINICIAN)"),
    ).toBe(true);
  });
});
