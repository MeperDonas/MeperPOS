import { UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { AuthController } from './auth.controller';
import { OrgRole } from '@prisma/client';
import {
  ACCESS_TOKEN_COOKIE,
  CSRF_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from './cookies.helper';

describe('AuthController after users boundary centralization', () => {
  const authServiceMock = {
    changePassword: jest.fn(),
    login: jest.fn(),
    selectOrg: jest.fn(),
    selectOrganization: jest.fn(),
    getUserOrganizations: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
  };

  const mockRes = (): Response =>
    ({
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    }) as unknown as Response;

  it('does not expose admin lifecycle endpoints anymore', () => {
    const controller = new AuthController(authServiceMock as never);

    expect(controller).not.toHaveProperty('createUser');
    expect(controller).not.toHaveProperty('getUsers');
    expect(controller).not.toHaveProperty('deleteUser');
    expect(controller).not.toHaveProperty('toggleUserActive');
    expect(controller).not.toHaveProperty('adminResetPassword');
  });

  it('keeps change-password delegated to auth service', async () => {
    const controller = new AuthController(authServiceMock as never);
    const dto = {
      currentPassword: 'ClaveActual1',
      newPassword: 'NuevaClaveSegura123',
    };
    const req = { user: { userId: 'admin-1' } };
    const expected = { message: 'Password changed successfully' };

    authServiceMock.changePassword.mockResolvedValue(expected);

    await expect(controller.changePassword(dto, req)).resolves.toEqual(
      expected,
    );
    expect(authServiceMock.changePassword).toHaveBeenCalledWith('admin-1', dto);
  });

  describe('login', () => {
    it('should pass ip and userAgent to authService.login', async () => {
      const controller = new AuthController(authServiceMock as never);
      const dto = { email: 'test@example.com', password: 'password123' };
      const req = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'Mozilla/5.0' },
        cookies: {},
      } as unknown as Request;
      const expected = { accessToken: 'token', user: { id: 'u1' } };

      authServiceMock.login.mockResolvedValue(expected);

      // Simular el comportamiento del controller
      const result = await controller.login(dto, req as any, mockRes());

      expect(authServiceMock.login).toHaveBeenCalledWith(
        dto,
        '127.0.0.1',
        'Mozilla/5.0',
      );
      expect(result).toEqual(expected);
    });

    it('should return requiresOrganizationSelection when service returns it', async () => {
      const controller = new AuthController(authServiceMock as never);
      const dto = { email: 'test@example.com', password: 'password123' };
      const req = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'Mozilla/5.0' },
        cookies: {},
      } as unknown as Request;
      const expected = {
        requiresOrganizationSelection: true,
        preAuthToken: 'pre-auth-token',
        organizations: [
          { id: 'org-1', name: 'Org One', role: 'ADMIN', plan: 'BASIC' },
        ],
      };

      authServiceMock.login.mockResolvedValue(expected);

      const result = await controller.login(dto, req as any, mockRes());

      expect(result).toEqual(expected);
    });
  });

  describe('selectOrganization', () => {
    it('should delegate to authService.selectOrganization with correct params', async () => {
      const controller = new AuthController(authServiceMock as never);
      const dto = { preAuthToken: 'pre-auth-token', organizationId: 'org-1' };
      const expected = {
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
        user: { id: 'user-1', organizationId: 'org-1', role: OrgRole.ADMIN },
      };

      authServiceMock.selectOrganization.mockResolvedValue(expected);

      const result = await controller.selectOrganization(
        dto,
        { cookies: {} },
        mockRes(),
      );

      expect(authServiceMock.selectOrganization).toHaveBeenCalledWith(
        'pre-auth-token',
        'org-1',
      );
      // Refresh token is cookie-only: never present in the response body.
      expect(result).toEqual({
        accessToken: 'new-token',
        user: { id: 'user-1', organizationId: 'org-1', role: OrgRole.ADMIN },
      });
    });
  });

  describe('selectOrg', () => {
    it('should delegate to authService.selectOrg with correct params', async () => {
      const controller = new AuthController(authServiceMock as never);
      const dto = { organizationId: 'org-1' };
      const req = { user: { userId: 'user-1' }, cookies: {} };
      const expected = {
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
        user: { id: 'user-1', organizationId: 'org-1', role: OrgRole.ADMIN },
      };

      authServiceMock.selectOrg.mockResolvedValue(expected);

      const result = await controller.selectOrg(dto, req, mockRes());

      expect(authServiceMock.selectOrg).toHaveBeenCalledWith('user-1', 'org-1');
      // Refresh token is cookie-only: never present in the response body.
      expect(result).toEqual({
        accessToken: 'new-token',
        user: { id: 'user-1', organizationId: 'org-1', role: OrgRole.ADMIN },
      });
    });
  });

  describe('getOrganizations', () => {
    it('should delegate to authService.getUserOrganizations with userId', async () => {
      const controller = new AuthController(authServiceMock as never);
      const req = { user: { userId: 'user-1' } };
      const expected = {
        organizations: [
          {
            id: 'org-1',
            name: 'Org One',
            role: OrgRole.ADMIN,
            plan: 'BASIC',
            status: 'ACTIVE',
          },
        ],
      };

      authServiceMock.getUserOrganizations.mockResolvedValue(expected);

      const result = await controller.getOrganizations(req);

      expect(authServiceMock.getUserOrganizations).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('dual-mode session cookies (issue #48 slice C1)', () => {
    const tokenPair = {
      accessToken: 'access-jwt',
      refreshToken: 'raw-refresh',
      user: { id: 'user-1' },
    };
    const req = { ip: '127.0.0.1', headers: {}, cookies: {} };

    it('login sets httpOnly auth cookies plus readable csrf cookie', async () => {
      const controller = new AuthController(authServiceMock as never);
      const res = mockRes();
      authServiceMock.login.mockResolvedValue(tokenPair);

      await controller.login(
        { email: 'test@example.com', password: 'password123' },
        req as any,
        res,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        ACCESS_TOKEN_COOKIE,
        tokenPair.accessToken,
        expect.objectContaining({ httpOnly: true }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE,
        tokenPair.refreshToken,
        expect.objectContaining({ httpOnly: true, path: '/api/auth' }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        CSRF_TOKEN_COOKIE,
        expect.any(String),
        expect.objectContaining({ httpOnly: false }),
      );
    });

    it('login without token pair (org selection required) sets no cookies', async () => {
      const controller = new AuthController(authServiceMock as never);
      const res = mockRes();
      authServiceMock.login.mockResolvedValue({
        requiresOrganizationSelection: true,
        preAuthToken: 'pre-auth-token',
        organizations: [],
      });

      await controller.login(
        { email: 'test@example.com', password: 'password123' },
        req as any,
        res,
      );

      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('refresh resolves from refresh_token cookie alone (no body token)', async () => {
      const controller = new AuthController(authServiceMock as never);
      const res = mockRes();
      authServiceMock.refresh.mockResolvedValue(tokenPair);

      const result = await controller.refresh(
        {} as never,
        { cookies: { [REFRESH_TOKEN_COOKIE]: 'cookie-refresh-token' } } as any,
        res,
      );

      expect(authServiceMock.refresh).toHaveBeenCalledWith(
        'cookie-refresh-token',
      );
      // Rotated refresh token is cookie-only: never in the response body.
      expect(result).toEqual({
        accessToken: tokenPair.accessToken,
        user: tokenPair.user,
      });
      expect(result).not.toHaveProperty('refreshToken');
      // Rotated pair is written back into cookies.
      expect(res.cookie).toHaveBeenCalledWith(
        ACCESS_TOKEN_COOKIE,
        tokenPair.accessToken,
        expect.anything(),
      );
    });

    it('refresh falls back to legacy body refreshToken when no cookie', async () => {
      const controller = new AuthController(authServiceMock as never);
      authServiceMock.refresh.mockResolvedValue(tokenPair);

      await controller.refresh(
        { refreshToken: 'body-refresh-token' },
        { cookies: {} } as any,
        mockRes(),
      );

      expect(authServiceMock.refresh).toHaveBeenCalledWith(
        'body-refresh-token',
      );
    });

    it('refresh reuses existing csrf cookie instead of rotating it', async () => {
      const controller = new AuthController(authServiceMock as never);
      const res = mockRes();
      authServiceMock.refresh.mockResolvedValue(tokenPair);

      await controller.refresh(
        {},
        {
          cookies: {
            [REFRESH_TOKEN_COOKIE]: 'raw-refresh',
            [CSRF_TOKEN_COOKIE]: 'stable-csrf-value',
          },
        } as any,
        res,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        CSRF_TOKEN_COOKIE,
        'stable-csrf-value',
        expect.anything(),
      );
    });

    it('refresh throws UnauthorizedException when neither cookie nor body provide a token', async () => {
      const controller = new AuthController(authServiceMock as never);
      authServiceMock.refresh.mockClear();

      await expect(
        controller.refresh({} as never, { cookies: {} } as any, mockRes()),
      ).rejects.toThrow(new UnauthorizedException('Refresh token missing'));
      expect(authServiceMock.refresh).not.toHaveBeenCalled();
    });

    it('logout revokes server-side token and clears all three cookies', async () => {
      const controller = new AuthController(authServiceMock as never);
      const res = mockRes();
      authServiceMock.logout.mockResolvedValue(undefined);

      const result = await controller.logout(
        {},
        {
          cookies: { [REFRESH_TOKEN_COOKIE]: 'cookie-refresh-token' },
        } as any,
        res,
      );

      expect(authServiceMock.logout).toHaveBeenCalledWith(
        'cookie-refresh-token',
      );
      expect(res.clearCookie).toHaveBeenCalledTimes(3);
      expect(res.clearCookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE,
        expect.objectContaining({ path: '/api/auth' }),
      );
      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('logout works with legacy body token and clears cookies', async () => {
      const controller = new AuthController(authServiceMock as never);
      const res = mockRes();

      await controller.logout(
        { refreshToken: 'legacy-body-token' },
        { cookies: {} } as any,
        res,
      );

      expect(authServiceMock.logout).toHaveBeenCalledWith('legacy-body-token');
      expect(res.clearCookie).toHaveBeenCalledTimes(3);
    });

    it('selectOrganization sets session cookies on completed login', async () => {
      const controller = new AuthController(authServiceMock as never);
      const res = mockRes();
      authServiceMock.selectOrganization.mockResolvedValue(tokenPair);

      await controller.selectOrganization(
        { preAuthToken: 'pre-auth-token', organizationId: 'org-1' },
        req,
        res,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        ACCESS_TOKEN_COOKIE,
        tokenPair.accessToken,
        expect.anything(),
      );
    });
  });
});
