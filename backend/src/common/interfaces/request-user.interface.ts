import { OrgRole, OrgStatus } from '@prisma/client';

export interface RequestUser {
  userId: string;
  email: string;
  organizationId: string | null;
  role: OrgRole | 'SUPER_ADMIN';
  tokenVersion: number;
  isSuperAdmin: boolean;
  orgStatus?: OrgStatus;
}
