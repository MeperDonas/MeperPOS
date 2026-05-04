import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { OrgRole } from '@prisma/client';

describe('AuthController after users boundary centralization', () => {
  const authServiceMock = {
    changePassword: jest.fn(),
    login: jest.fn(),
    selectOrg: jest.fn(),
    selectOrganization: jest.fn(),
  };

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
      } as unknown as Request;
      const expected = { accessToken: 'token', user: { id: 'u1' } };

      authServiceMock.login.mockResolvedValue(expected);

      // Simular el comportamiento del controller
      const result = await controller.login(dto, req as any);

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
      } as unknown as Request;
      const expected = {
        requiresOrganizationSelection: true,
        preAuthToken: 'pre-auth-token',
        organizations: [
          { id: 'org-1', name: 'Org One', role: 'ADMIN', plan: 'BASIC' },
        ],
      };

      authServiceMock.login.mockResolvedValue(expected);

      const result = await controller.login(dto, req as any);

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

      const result = await controller.selectOrganization(dto);

      expect(authServiceMock.selectOrganization).toHaveBeenCalledWith(
        'pre-auth-token',
        'org-1',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('selectOrg', () => {
    it('should delegate to authService.selectOrg with correct params', async () => {
      const controller = new AuthController(authServiceMock as never);
      const dto = { organizationId: 'org-1' };
      const req = { user: { userId: 'user-1' } };
      const expected = {
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
        user: { id: 'user-1', organizationId: 'org-1', role: OrgRole.ADMIN },
      };

      authServiceMock.selectOrg.mockResolvedValue(expected);

      const result = await controller.selectOrg(dto, req);

      expect(authServiceMock.selectOrg).toHaveBeenCalledWith('user-1', 'org-1');
      expect(result).toEqual(expected);
    });
  });
});
