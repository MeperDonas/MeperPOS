import { SetMetadata } from '@nestjs/common';
import { OrgRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export type RoleType = OrgRole | 'SUPER_ADMIN';

export const Roles = (...roles: RoleType[]) => SetMetadata(ROLES_KEY, roles);
