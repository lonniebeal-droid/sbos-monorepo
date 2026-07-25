/**
 * Canonical, framework-agnostic domain rules shared across SBOS services.
 * Keeping these here prevents business logic from being duplicated between the
 * API guards/services and any other consumer.
 */

export type RoleName =
  | "SUPER_ADMIN"
  | "ORG_ADMIN"
  | "SUPERVISOR"
  | "CLINICIAN"
  | "BILLING"
  | "FRONT_DESK";

/** Lower rank = broader authority. */
export const ROLE_RANK: Record<RoleName, number> = {
  SUPER_ADMIN: 0,
  ORG_ADMIN: 1,
  SUPERVISOR: 2,
  CLINICIAN: 3,
  BILLING: 4,
  FRONT_DESK: 5,
};

/**
 * Whether an acting role satisfies a required role. A higher-privilege role
 * (lower rank) always satisfies a requirement for a lower-privilege role.
 */
export function roleSatisfies(acting: RoleName, required: RoleName): boolean {
  return ROLE_RANK[acting] <= ROLE_RANK[required];
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
