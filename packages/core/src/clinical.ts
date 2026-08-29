/**
 * Canonical, framework-agnostic domain rules shared across SBOS services.
 * Keeping these here prevents business logic from being duplicated between the
 * API guards/services and any other consumer.
 */

export type RoleName =
  | "SUPER_ADMIN"
  | "ORG_ADMIN"
  | "SUPERVISOR"
  | "BILLING"
  | "CLINICIAN"
  | "FRONT_DESK";
/**
 * Explicit role satisfaction map.
 * Use this map to determine whether an acting role satisfies a required role.
 * This replaces a linear numeric ordering to allow isolated functional roles
 * (FRONT_DESK, CLINICIAN, BILLING) that do not implicitly satisfy each other.
 */
export const ROLE_SATISFIES: Record<RoleName, RoleName[]> = {
  SUPER_ADMIN: [
    'SUPER_ADMIN',
    'ORG_ADMIN',
    'SUPERVISOR',
    'BILLING',
    'CLINICIAN',
    'FRONT_DESK',
  ],
  ORG_ADMIN: [
    'ORG_ADMIN',
    'SUPERVISOR',
    'BILLING',
    'CLINICIAN',
    'FRONT_DESK',
  ],
  SUPERVISOR: ['SUPERVISOR', 'CLINICIAN'],
  BILLING: ['BILLING'],
  CLINICIAN: ['CLINICIAN'],
  FRONT_DESK: ['FRONT_DESK'],
};

/** Whether an acting role satisfies a required role. */
export function roleSatisfies(acting: RoleName, required: RoleName): boolean {
  const allowed = ROLE_SATISFIES[acting] ?? [];
  return allowed.includes(required);
}

/** Whether an acting role satisfies at least one of the required roles. */
export function roleSatisfiesAny(
  acting: RoleName,
  required: RoleName[],
): boolean {
  return required.some((role) => roleSatisfies(acting, role));
}

export type NoteStatusName =
  | "DRAFT"
  | "PENDING_COSIGN"
  | "SIGNED"
  | "AMENDED"
  | "LOCKED";

/** A note's content may only be edited in these states. */
export function isNoteEditable(status: NoteStatusName): boolean {
  return status === "DRAFT" || status === "PENDING_COSIGN";
}

/** The status a note moves to when its author signs it. */
export function noteStatusAfterSign(requiresCosign: boolean): NoteStatusName {
  return requiresCosign ? "PENDING_COSIGN" : "SIGNED";
}
