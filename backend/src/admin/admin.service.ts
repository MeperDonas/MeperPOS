import { Injectable, ConflictException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationStatusDto } from './dto/update-organization-status.dto';
import { UpdateOrganizationPlanDto } from './dto/update-organization-plan.dto';
import { OrgRole, OrgStatus, PlanType } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  async createOrganization(dto: CreateOrganizationDto) {
    const existingOrg = await this.prisma.organization.findFirst({
      where: { slug: dto.slug },
    });

    if (existingOrg) {
      throw new ConflictException('Organization slug already exists');
    }

    let adminUser: { id: string; email: string; name: string } | null = null;
    let tempPassword: string | null = null;

    if (dto.admin) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: dto.admin.email },
      });

      if (existingUser) {
        adminUser = existingUser;
      } else {
        tempPassword = dto.admin.password || crypto.randomBytes(8).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        adminUser = await this.prisma.user.create({
          data: {
            email: dto.admin.email,
            name: dto.admin.name,
            password: hashedPassword,
          },
        });
      }
    }

    const organization = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        plan: dto.plan ?? PlanType.BASIC,
      },
    });

    if (adminUser) {
      await this.prisma.organizationUser.create({
        data: {
          userId: adminUser.id,
          organizationId: organization.id,
          role: OrgRole.ADMIN,
          isPrimaryOwner: true,
        },
      });
    }

    await this.prisma.organizationSequence.createMany({
      data: [
        {
          organizationId: organization.id,
          type: 'SALE',
          currentNumber: 0,
        },
        {
          organizationId: organization.id,
          type: 'PO',
          currentNumber: 0,
        },
      ],
    });

    await this.prisma.cashRegister.create({
      data: {
        organizationId: organization.id,
        name: 'Caja Principal',
        isDefault: true,
      },
    });

    return {
      organization,
      adminUser: adminUser
        ? { id: adminUser.id, email: adminUser.email, name: adminUser.name }
        : undefined,
      tempPassword: tempPassword ?? undefined,
      message: adminUser
        ? tempPassword
          ? 'Organization created successfully with a new admin user. Temporary password provided.'
          : 'Organization created successfully. Existing user assigned as admin.'
        : 'Organization created successfully. No admin assigned.',
    };
  }

  async findAllOrganizations() {
    const organizations = await this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    return organizations.map((org) => ({
      ...org,
      userCount: org._count.users,
      _count: undefined,
    }));
  }

  async findOrganizationById(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                active: true,
              },
            },
          },
        },
        sequences: true,
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async updateStatus(id: string, dto: UpdateOrganizationStatusDto) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const updated = await this.prisma.organization.update({
      where: { id },
      data: { status: dto.status },
    });

    if (dto.status === OrgStatus.SUSPENDED) {
      await this.authService.revokeOrganizationTokens(id);
    }

    return updated;
  }

  async updatePlan(id: string, dto: UpdateOrganizationPlanDto) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return this.prisma.organization.update({
      where: { id },
      data: { plan: dto.plan },
    });
  }

  async transferPrimaryOwner(
    organizationId: string,
    currentOwnerId: string,
    newOwnerId: string,
  ) {
    if (currentOwnerId === newOwnerId) {
      throw new BadRequestException('Current owner and new owner must be different');
    }

    const currentOwner = await this.prisma.organizationUser.findFirst({
      where: {
        organizationId,
        userId: currentOwnerId,
        isPrimaryOwner: true,
      },
    });

    if (!currentOwner) {
      throw new ForbiddenException('Current user is not the primary owner of this organization');
    }

    const newOwner = await this.prisma.organizationUser.findFirst({
      where: {
        organizationId,
        userId: newOwnerId,
        role: OrgRole.ADMIN,
      },
    });

    if (!newOwner) {
      throw new ForbiddenException('New owner must be an ADMIN member of this organization');
    }

    await this.prisma.$transaction([
      this.prisma.organizationUser.update({
        where: { id: currentOwner.id },
        data: { isPrimaryOwner: false },
      }),
      this.prisma.organizationUser.update({
        where: { id: newOwner.id },
        data: { isPrimaryOwner: true },
      }),
    ]);

    return {
      success: true,
      message: 'Primary ownership transferred successfully',
      organizationId,
      previousOwnerId: currentOwnerId,
      newOwnerId,
    };
  }

  async getMetrics() {
    const [
      totalOrgs,
      activeOrgs,
      trialOrgs,
      suspendedOrgs,
      totalUsers,
      orgsByPlan,
    ] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.organization.count({ where: { status: OrgStatus.ACTIVE } }),
      this.prisma.organization.count({ where: { status: OrgStatus.TRIAL } }),
      this.prisma.organization.count({ where: { status: OrgStatus.SUSPENDED } }),
      this.prisma.user.count(),
      this.prisma.organization.groupBy({
        by: ['plan'],
        _count: { id: true },
      }),
    ]);

    return {
      totalOrganizations: totalOrgs,
      activeOrganizations: activeOrgs,
      trialOrganizations: trialOrgs,
      suspendedOrganizations: suspendedOrgs,
      totalUsers,
      organizationsByPlan: orgsByPlan.reduce(
        (acc, curr) => {
          acc[curr.plan] = curr._count.id;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }
}
