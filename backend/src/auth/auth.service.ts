import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  LoginDto,
  RegisterDto,
  UpdateProfileDto,
  ChangePasswordDto,
} from './dto/auth.dto';
import { OrgRole, OrgStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, name } = registerDto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    const { email, password, organizationId } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // SuperAdmin bypass
    if (user.isSuperAdmin) {
      return this.generateTokenPair(
        user,
        { organizationId: null, role: 'SUPER_ADMIN' as const },
        ipAddress,
        userAgent,
      );
    }

    // If organizationId is explicitly provided, validate membership directly
    if (organizationId) {
      const orgUser = await this.prisma.organizationUser.findFirst({
        where: {
          userId: user.id,
          organizationId,
        },
      });

      if (!orgUser) {
        throw new UnauthorizedException('Organization membership not found');
      }

      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { status: true },
      });

      if (org?.status === OrgStatus.SUSPENDED) {
        throw new UnauthorizedException('Organization is suspended');
      }

      return this.generateTokenPair(user, orgUser, ipAddress, userAgent);
    }

    // No organizationId provided — count user's organizations
    const userOrgs = await this.prisma.organizationUser.findMany({
      where: { userId: user.id },
      orderBy: { joinedAt: 'asc' },
      include: {
        organization: {
          select: { id: true, name: true, plan: true, status: true },
        },
      },
    });

    if (userOrgs.length === 0) {
      throw new UnauthorizedException('User has no organizations');
    }

    if (userOrgs.length === 1) {
      const orgUser = userOrgs[0];

      if (orgUser.organization.status === OrgStatus.SUSPENDED) {
        throw new UnauthorizedException('Organization is suspended');
      }

      return this.generateTokenPair(
        user,
        {
          organizationId: orgUser.organizationId,
          role: orgUser.role,
        },
        ipAddress,
        userAgent,
      );
    }

    // 2+ organizations — require selection
    const preAuthToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        type: 'pre-auth',
      },
      { expiresIn: '5m' },
    );

    return {
      requiresOrganizationSelection: true,
      preAuthToken,
      organizations: userOrgs.map((uo) => ({
        id: uo.organizationId,
        name: uo.organization.name,
        role: uo.role,
        plan: uo.organization.plan,
      })),
    };
  }

  async selectOrganization(preAuthToken: string, organizationId: string) {
    let payload: { sub: string; email: string; type: string };

    try {
      payload = this.jwtService.verify(preAuthToken);
    } catch {
      throw new UnauthorizedException('Invalid pre-authentication token');
    }

    if (payload.type !== 'pre-auth') {
      throw new UnauthorizedException('Invalid pre-authentication token');
    }

    const userId = payload.sub;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const orgUser = await this.prisma.organizationUser.findFirst({
      where: {
        userId,
        organizationId,
      },
    });

    if (!orgUser) {
      throw new UnauthorizedException('Organization membership not found');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { status: true, name: true, plan: true },
    });

    if (!org) {
      throw new UnauthorizedException('Organization not found');
    }

    if (org.status === OrgStatus.SUSPENDED) {
      throw new ForbiddenException('Organization is suspended');
    }

    return this.generateTokenPair(user, orgUser);
  }

  private async generateTokenPair(
    user: {
      id: string;
      email: string;
      name: string;
      tokenVersion: number;
    },
    orgUser: {
      organizationId: string | null;
      role: OrgRole | 'SUPER_ADMIN';
    },
    ipAddress?: string,
    userAgent?: string,
  ) {
    const payload = {
      sub: user.id,
      email: user.email,
      organizationId: orgUser.organizationId,
      role: orgUser.role,
      tokenVersion: user.tokenVersion,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '8h',
    });

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(rawRefreshToken)
      .digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshTokenHash,
        expiresAt,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organizationId: orgUser.organizationId,
        role: orgUser.role,
      },
    };
  }

  async refresh(rawRefreshToken: string) {
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawRefreshToken)
      .digest('hex');

    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    });

    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (refreshToken.revokedAt) {
      throw new UnauthorizedException('Refresh token revoked');
    }

    if (refreshToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    if (!refreshToken.user.active) {
      throw new UnauthorizedException('User inactive');
    }

    // SuperAdmin bypass
    if (refreshToken.user.isSuperAdmin) {
      // Revocar token anterior
      await this.prisma.refreshToken.update({
        where: { id: refreshToken.id },
        data: { revokedAt: new Date() },
      });

      return this.generateTokenPair(refreshToken.user, {
        organizationId: null,
        role: 'SUPER_ADMIN' as const,
      });
    }

    const orgUser = await this.prisma.organizationUser.findFirst({
      where: { userId: refreshToken.user.id },
      orderBy: { joinedAt: 'asc' },
    });

    if (!orgUser) {
      throw new UnauthorizedException('User has no organizations');
    }

    // Check organization status
    const org = await this.prisma.organization.findUnique({
      where: { id: orgUser.organizationId },
      select: { status: true },
    });

    if (org?.status === OrgStatus.SUSPENDED) {
      throw new UnauthorizedException('Organization is suspended');
    }

    // Revocar token anterior
    await this.prisma.refreshToken.update({
      where: { id: refreshToken.id },
      data: { revokedAt: new Date() },
    });

    return this.generateTokenPair(refreshToken.user, orgUser);
  }

  async revokeUserTokens(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...result } = user;

    if (user.isSuperAdmin) {
      return {
        ...result,
        role: 'SUPER_ADMIN',
        isSuperAdmin: true,
      };
    }

    const orgUser = await this.prisma.organizationUser.findFirst({
      where: { userId },
      include: {
        organization: {
          select: {
            id: true,
            plan: true,
            status: true,
            trialEndsAt: true,
            billingStatus: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    // Mapear OWNER (legacy) a ADMIN para compatibilidad
    const role =
      orgUser?.role === 'OWNER' ? 'ADMIN' : (orgUser?.role ?? 'MEMBER');

    return {
      ...result,
      role,
      organizationId: orgUser?.organizationId ?? null,
      organization: orgUser?.organization ?? null,
      isSuperAdmin: false,
    };
  }

  async revokeOrganizationTokens(organizationId: string) {
    // Revocar tokens de todos los usuarios de la organización
    const orgUsers = await this.prisma.organizationUser.findMany({
      where: { organizationId },
      select: { userId: true },
    });

    const userIds = orgUsers.map((ou) => ou.userId);

    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { userId: { in: userIds }, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { tokenVersion: { increment: 1 } },
      }),
    ]);
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const { name, email } = updateProfileDto;

    if (email) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          email,
          NOT: { id: userId },
        },
      });

      if (existingUser) {
        throw new ConflictException('Email already in use');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(email && { email }),
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...result } = user;
    return result;
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Password changed successfully' };
  }

  async selectOrg(userId: string, organizationId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const orgUser = await this.prisma.organizationUser.findFirst({
      where: {
        userId,
        organizationId,
      },
    });

    if (!orgUser) {
      throw new UnauthorizedException('Organization membership not found');
    }

    // Check organization status
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { status: true },
    });

    if (org?.status === OrgStatus.SUSPENDED) {
      throw new UnauthorizedException('Organization is suspended');
    }

    return this.generateTokenPair(user, orgUser);
  }
}
