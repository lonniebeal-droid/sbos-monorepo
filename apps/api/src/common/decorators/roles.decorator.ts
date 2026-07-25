import { SetMetadata } from '@nestjs/common';

import { Role } from '../enums/role.enum';

export const ROLES_KEY = 'roles';

/** Restricts a route to the given roles (or any higher-privilege role). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
