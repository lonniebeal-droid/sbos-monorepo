import type { UserRole } from "./auth";

/**
 * Development credential store. Used only until the web app is wired to the
 * NestJS auth API (Phase 2). Passwords here are for local sign-in convenience
 * and are never bundled into production auth flows.
 */
export interface DevUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  organizationId: string;
}

export const devUsers: DevUser[] = [
  {
    id: "usr_admin",
    email: "admin@sbos.health",
    password: "Sbos!2026",
    name: "Alex Administrator",
    role: "ORG_ADMIN",
    organizationId: "org_success_brand",
  },
  {
    id: "usr_clinician",
    email: "clinician@sbos.health",
    password: "Sbos!2026",
    name: "Dr. Riley Chen",
    role: "CLINICIAN",
    organizationId: "org_success_brand",
  },
];

export function findDevUser(email: string, password: string): DevUser | null {
  const normalized = email.trim().toLowerCase();
  return (
    devUsers.find(
      (user) => user.email === normalized && user.password === password,
    ) ?? null
  );
}
