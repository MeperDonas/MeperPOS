import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { OrgRole, PlanType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcryptjs');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
    organizationUser: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-access-token'),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashed-password',
      tokenVersion: 1,
      active: true,
      isSuperAdmin: false,
    };

    const mockSuperAdmin = {
      id: 'user-sa',
      email: 'admin@sistema.com',
      name: 'Super Admin',
      password: 'hashed-password',
      tokenVersion: 1,
      active: true,
      isSuperAdmin: true,
    };

    const mockOrgUser = {
      id: 'ou-1',
      userId: 'user-1',
      organizationId: 'org-1',
      role: OrgRole.ADMIN,
      joinedAt: new Date(),
    };

    it('should throw UnauthorizedException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        active: false,
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('should throw UnauthorizedException when organizationId provided but membership not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.organizationUser.findFirst.mockResolvedValue(null);

      await expect(
        service.login({ ...loginDto, organizationId: 'org-1' }),
      ).rejects.toThrow(
        new UnauthorizedException('Organization membership not found'),
      );
    });

    it('should throw UnauthorizedException when user has no organizations', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.organizationUser.findMany.mockResolvedValue([]);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('User has no organizations'),
      );
    });

    it('should return requiresOrganizationSelection when user has 2+ organizations', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.organizationUser.findMany.mockResolvedValue([
        {
          ...mockOrgUser,
          organization: {
            id: 'org-1',
            name: 'Org One',
            plan: PlanType.BASIC,
            status: 'ACTIVE',
          },
        },
        {
          id: 'ou-2',
          userId: 'user-1',
          organizationId: 'org-2',
          role: OrgRole.MEMBER,
          joinedAt: new Date(),
          organization: {
            id: 'org-2',
            name: 'Org Two',
            plan: PlanType.PRO,
            status: 'ACTIVE',
          },
        },
      ]);
      mockJwtService.sign.mockReturnValueOnce('mock-pre-auth-token');

      const result = await service.login(loginDto);

      expect(result).toEqual({
        requiresOrganizationSelection: true,
        preAuthToken: 'mock-pre-auth-token',
        organizations: [
          {
            id: 'org-1',
            name: 'Org One',
            role: OrgRole.ADMIN,
            plan: PlanType.BASIC,
          },
          {
            id: 'org-2',
            name: 'Org Two',
            role: OrgRole.MEMBER,
            plan: PlanType.PRO,
          },
        ],
      });

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        {
          sub: 'user-1',
          email: 'test@example.com',
          type: 'pre-auth',
        },
        { expiresIn: '5m' },
      );
    });

    it('should login successfully with provided organizationId', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.organizationUser.findFirst.mockResolvedValue(mockOrgUser);
      mockPrisma.organization.findUnique.mockResolvedValue({
        status: 'ACTIVE',
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

      const result = await service.login({
        ...loginDto,
        organizationId: 'org-1',
      });

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        organizationId: 'org-1',
        role: OrgRole.ADMIN,
      });

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-1',
          email: 'test@example.com',
          organizationId: 'org-1',
          role: OrgRole.ADMIN,
          tokenVersion: 1,
        }),
        { expiresIn: '8h' },
      );
    });

    it('should login successfully using first organization when none provided and user has 1 org', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.organizationUser.findMany.mockResolvedValue([
        {
          ...mockOrgUser,
          organization: {
            id: 'org-1',
            name: 'Org One',
            plan: PlanType.BASIC,
            status: 'ACTIVE',
          },
        },
      ]);
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

      const result = await service.login(loginDto);

      expect(result.user.organizationId).toBe('org-1');
      expect(mockPrisma.organizationUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          orderBy: { joinedAt: 'asc' },
        }),
      );
    });

    it('should pass ipAddress and userAgent to refresh token creation', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.organizationUser.findFirst.mockResolvedValue(mockOrgUser);
      mockPrisma.organization.findUnique.mockResolvedValue({
        status: 'ACTIVE',
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

      await service.login(loginDto, '127.0.0.1', 'Mozilla/5.0');

      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ipAddress: '127.0.0.1',
            userAgent: 'Mozilla/5.0',
          }),
        }),
      );
    });

    it('should login SuperAdmin without requiring OrganizationUser', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockSuperAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

      const result = await service.login({
        email: 'admin@sistema.com',
        password: 'admin123',
      });

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.user.organizationId).toBeNull();
      expect(result.user.role).toBe('SUPER_ADMIN');
      expect(mockPrisma.organizationUser.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('selectOrganization', () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashed-password',
      tokenVersion: 1,
      active: true,
      isSuperAdmin: false,
    };

    const mockOrgUser = {
      id: 'ou-1',
      userId: 'user-1',
      organizationId: 'org-1',
      role: OrgRole.ADMIN,
      joinedAt: new Date(),
    };

    it('should validate preAuthToken and return final JWT', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-1',
        email: 'test@example.com',
        type: 'pre-auth',
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.organizationUser.findFirst.mockResolvedValue(mockOrgUser);
      mockPrisma.organization.findUnique.mockResolvedValue({
        status: 'ACTIVE',
        name: 'Org One',
        plan: PlanType.BASIC,
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

      const result = await service.selectOrganization('valid-token', 'org-1');

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.user.organizationId).toBe('org-1');
      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-token');
    });

    it('should throw UnauthorizedException with invalid preAuthToken', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(
        service.selectOrganization('invalid-token', 'org-1'),
      ).rejects.toThrow(
        new UnauthorizedException('Invalid pre-authentication token'),
      );
    });

    it('should throw UnauthorizedException when user does not belong to organization', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-1',
        email: 'test@example.com',
        type: 'pre-auth',
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.organizationUser.findFirst.mockResolvedValue(null);

      await expect(
        service.selectOrganization('valid-token', 'org-2'),
      ).rejects.toThrow(
        new UnauthorizedException('Organization membership not found'),
      );
    });

    it('should throw ForbiddenException when organization is suspended', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-1',
        email: 'test@example.com',
        type: 'pre-auth',
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.organizationUser.findFirst.mockResolvedValue(mockOrgUser);
      mockPrisma.organization.findUnique.mockResolvedValue({
        status: 'SUSPENDED',
        name: 'Org One',
        plan: PlanType.BASIC,
      });

      await expect(
        service.selectOrganization('valid-token', 'org-1'),
      ).rejects.toThrow(new ForbiddenException('Organization is suspended'));
    });

    it('should throw UnauthorizedException when preAuthToken type is not pre-auth', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-1',
        email: 'test@example.com',
        type: 'access',
      });

      await expect(
        service.selectOrganization('valid-token', 'org-1'),
      ).rejects.toThrow(
        new UnauthorizedException('Invalid pre-authentication token'),
      );
    });
  });
});
