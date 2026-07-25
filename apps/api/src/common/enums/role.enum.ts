/**
 * Role hierarchy for role-based access control across the SBOS platform.
 * Ordering (lower index = broader authority) is used by the RolesGuard to allow
 * higher-privilege roles to satisfy checks for lower-privilege requirements.
 */
export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ORG_ADMIN = 'ORG_ADMIN',
  SUPERVISOR = 'SUPERVISOR',
  CLINICIAN = 'CLINICIAN',
  BILLING = 'BILLING',
  FRONT_DESK = 'FRONT_DESK',
}

export const ROLE_HIERARCHY: Role[] = [
  Role.SUPER_ADMIN,
  Role.ORG_ADMIN,
  Role.SUPERVISOR,
  Role.CLINICIAN,
  Role.BILLING,
  Role.FRONT_DESK,
];
