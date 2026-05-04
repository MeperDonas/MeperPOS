import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    tokenVersion: number;
    organizationId: string | null;
    role: string;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException('User not found or inactive');
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Token revoked');
    }

    // SuperAdmin bypass
    if (user.isSuperAdmin || payload.role === 'SUPER_ADMIN') {
      return {
        userId: payload.sub,
        email: payload.email,
        organizationId: payload.organizationId ?? null,
        role: 'SUPER_ADMIN' as const,
        tokenVersion: payload.tokenVersion,
        isSuperAdmin: true,
      };
    }

    const orgUser = await this.prisma.organizationUser.findFirst({
      where: {
        userId: user.id,
        organizationId: payload.organizationId ?? undefined,
      },
    });

    if (!orgUser) {
      throw new UnauthorizedException('Organization membership not found');
    }

    // Fetch organization status for status guard
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgUser.organizationId },
      select: { status: true },
    });

    return {
      userId: payload.sub,
      email: payload.email,
      organizationId: orgUser.organizationId,
      role: orgUser.role,
      tokenVersion: payload.tokenVersion,
      isSuperAdmin: false,
      orgStatus: organization?.status,
    };
  }
}
