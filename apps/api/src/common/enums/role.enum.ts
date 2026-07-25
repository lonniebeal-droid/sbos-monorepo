/**
 * RBAC roles for the SBOS platform. The hierarchy (which role satisfies which
 * requirement) is defined once in @sbos/core (`roleSatisfies`) and consumed by
 * the RolesGuard, so this enum only enumerates the role values.
 */
export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ORG_ADMIN = 'ORG_ADMIN',
  SUPERVISOR = 'SUPERVISOR',
  CLINICIAN = 'CLINICIAN',
  BILLING = 'BILLING',
  FRONT_DESK = 'FRONT_DESK',
}
