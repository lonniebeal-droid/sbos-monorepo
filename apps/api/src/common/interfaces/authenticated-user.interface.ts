import type { Role } from '../enums/role.enum';

/** Shape of the user attached to each request after JWT validation. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  organizationId: string;
}

/** Claims embedded in issued access tokens. */
export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: Role;
  organizationId: string;
  type: 'access' | 'refresh';
}
