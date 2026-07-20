import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { OrgRole } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { PlanLimitService } from '../plan-limits/plan-limits.service';

type AuditContext = {
  resource?: string;
  resourceId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
};

const userAdminSelect = {
  id: true,
  email: true,
  name: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

function attachAuditContext<T extends object>(
  value: T,
  context: AuditContext,
): T {
  Object.defineProperty(value, '__auditContext', {
    value: context,
    enumerable: false,
    configurable: true,
  });

  return value;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planLimitService: PlanLimitService,
  ) {}

  async create(createUserDto: CreateUserDto, organizationId?: string) {
    const { email, password, name, role } = createUserDto;

    await this.ensureEmailAvailable(email);

    const hashedPassword = await bcrypt.hash(password, 10);

    const createdUser = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        ...(organizationId
          ? {
              organizationUsers: {
                create: {
                  organizationId,
                  role: role ?? OrgRole.CASHIER,
                },
              },
            }
          : {}),
      },
      select: userAdminSelect,
    });

    if (organizationId) {
      this.planLimitService.invalidateCache('users', organizationId);
    }

    return attachAuditContext(createdUser, {
      resource: 'User',
      resourceId: createdUser.id,
      summary: `Created user ${createdUser.name} (${createdUser.email})`,
      metadata: {
        targetUserEmail: createdUser.email,
        targetUserName: createdUser.name,
        active: createdUser.active,
        organizationId: organizationId ?? null,
        role: role ?? OrgRole.CASHIER,
      },
    });
  }

  async findAll(organizationId?: string) {
    if (!organizationId) {
      return [];
    }

    return this.prisma.user.findMany({
      where: {
        organizationUsers: {
          some: { organizationId },
        },
      },
      orderBy: { createdAt: 'desc' },
      select: userAdminSelect,
    });
  }

  async update(
    adminUserId: string,
    userId: string,
    updateUserDto: UpdateUserDto,
    organizationId?: string,
  ) {
    const previousUser = await this.findUserOrThrow(userId, organizationId);

    if (updateUserDto.email) {
      await this.ensureEmailAvailable(updateUserDto.email, userId);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(updateUserDto.name !== undefined
          ? { name: updateUserDto.name }
          : {}),
        ...(updateUserDto.email !== undefined
          ? { email: updateUserDto.email }
          : {}),
      },
      select: userAdminSelect,
    });

    const changedFields: string[] = [];
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    if (
      updateUserDto.name !== undefined &&
      previousUser.name !== updatedUser.name
    ) {
      changedFields.push('name');
      changes.name = { from: previousUser.name, to: updatedUser.name };
    }

    if (
      updateUserDto.email !== undefined &&
      previousUser.email !== updatedUser.email
    ) {
      changedFields.push('email');
      changes.email = { from: previousUser.email, to: updatedUser.email };
    }

    const summary =
      changedFields.length > 0
        ? `Updated user ${updatedUser.name} (${updatedUser.email}): ${changedFields.join(', ')}`
        : `Update requested for user ${updatedUser.name} (${updatedUser.email}) without effective field changes`;

    return attachAuditContext(updatedUser, {
      resource: 'User',
      resourceId: updatedUser.id,
      summary,
      metadata: {
        targetUserEmail: updatedUser.email,
        targetUserName: updatedUser.name,
        changedFields,
        changes,
      },
    });
  }

  async toggleActive(
    adminUserId: string,
    userId: string,
    organizationId?: string,
  ) {
    if (adminUserId === userId) {
      throw new BadRequestException(
        'Admins cannot deactivate their own account',
      );
    }

    const user = await this.findUserOrThrow(userId, organizationId);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { active: !user.active },
      select: userAdminSelect,
    });

    return attachAuditContext(updatedUser, {
      resource: 'User',
      resourceId: updatedUser.id,
      summary: `${updatedUser.active ? 'Reactivated' : 'Deactivated'} user ${updatedUser.name} (${updatedUser.email})`,
      metadata: {
        targetUserEmail: updatedUser.email,
        targetUserName: updatedUser.name,
        previousActive: user.active,
        nextActive: updatedUser.active,
      },
    });
  }

  async resetPassword(
    adminUserId: string,
    userId: string,
    dto: ResetUserPasswordDto,
    organizationId: string,
  ) {
    const targetUser = await this.findUserOrThrow(userId, organizationId);
    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        organizationId,
        action: 'ADMIN_PASSWORD_RESET',
        resource: 'User',
        resourceId: userId,
        metadata: {
          summary: `Reset password for user ${targetUser.name} (${targetUser.email})`,
          targetUserId: userId,
          targetUserEmail: targetUser.email,
          targetUserName: targetUser.name,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return { message: 'Contraseña restablecida exitosamente' };
  }

  async remove(adminUserId: string, userId: string, organizationId?: string) {
    if (adminUserId === userId) {
      throw new BadRequestException('Admins cannot delete their own account');
    }

    const user = await this.findUserOrThrow(userId, organizationId);

    if (organizationId) {
      const orgUser = await this.prisma.organizationUser.findFirst({
        where: { userId, organizationId },
      });

      if (!orgUser) {
        throw new ForbiddenException(
          'User does not belong to this organization',
        );
      }

      if (orgUser.isPrimaryOwner) {
        throw new BadRequestException(
          'Cannot remove the primary owner. Transfer ownership first.',
        );
      }

      if (orgUser.role === OrgRole.ADMIN) {
        const adminCount = await this.prisma.organizationUser.count({
          where: {
            organizationId,
            role: OrgRole.ADMIN,
          },
        });

        if (adminCount <= 1) {
          throw new BadRequestException(
            'Cannot remove the last admin of an organization',
          );
        }
      }
    }

    await this.prisma.user.delete({
      where: { id: userId },
    });

    return attachAuditContext(
      { message: 'User deleted successfully' },
      {
        resource: 'User',
        resourceId: userId,
        summary: `Deleted user ${user.name} (${user.email})`,
        metadata: {
          targetUserEmail: user.email,
          targetUserName: user.name,
          active: user.active,
        },
      },
    );
  }

  private async ensureEmailAvailable(email: string, excludeUserId?: string) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email,
        ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
      },
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }
  }

  private async findUserOrThrow(userId: string, organizationId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (organizationId) {
      const orgUser = await this.prisma.organizationUser.findFirst({
        where: { userId, organizationId },
      });

      if (!orgUser) {
        throw new ForbiddenException(
          'User does not belong to this organization',
        );
      }
    }

    return user;
  }
}
