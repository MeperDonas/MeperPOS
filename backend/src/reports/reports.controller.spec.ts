import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgRole } from '@prisma/client';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ReportsController } from './reports.controller';
import type { RequestUser } from '../common/interfaces/request-user.interface';

type DashboardResponse = {
  appliedRange: { timezone: string };
  comparisonRange: unknown;
};

const mockUser: RequestUser = {
  userId: 'user-1',
  email: 'test@example.com',
  organizationId: 'org-1',
  role: OrgRole.ADMIN,
  tokenVersion: 1,
  isSuperAdmin: false,
};

describe('ReportsController', () => {
  const reportsServiceMock = {
    getDashboardKPIs: jest.fn(),
    getUserPerformance: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createContext = (
    handler: (...args: unknown[]) => unknown,
    role: OrgRole,
  ): ExecutionContext =>
    ({
      getHandler: () => handler,
      getClass: () => ReportsController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role } }),
      }),
    }) as unknown as ExecutionContext;

  it('restricts reports analytics to admins only', () => {
    const requiredRoles = Reflect.getMetadata(ROLES_KEY, ReportsController);

    expect(requiredRoles).toEqual([OrgRole.ADMIN]);
  });

  it('denies analytics access to unauthorized business roles', () => {
    const controller = new ReportsController(reportsServiceMock as never);
    const guard = new RolesGuard(new Reflector());

    expect(() =>
      guard.canActivate(
        createContext(controller.getUserPerformance, OrgRole.MEMBER),
      ),
    ).toThrow(ForbiddenException);
  });

  it('forwards date filters to service and returns metadata-bearing response', async () => {
    const controller = new ReportsController(reportsServiceMock as never);
    reportsServiceMock.getDashboardKPIs.mockResolvedValue({
      totalSales: 0,
      appliedRange: {
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        timezone: 'America/Bogota',
      },
      comparisonRange: {
        startDate: '2026-01-30',
        endDate: '2026-02-28',
        timezone: 'America/Bogota',
      },
    });

    const result = (await controller.getDashboard(
      mockUser,
      '2026-03-01',
      '2026-03-31',
    )) as DashboardResponse;

    expect(reportsServiceMock.getDashboardKPIs).toHaveBeenCalledWith(
      'org-1',
      '2026-03-01',
      '2026-03-31',
    );
    expect(result.appliedRange.timezone).toBe('America/Bogota');
    expect(result.comparisonRange).toBeDefined();
  });

  it('parses compare and userIds before delegating user performance analytics', async () => {
    const controller = new ReportsController(reportsServiceMock as never);
    reportsServiceMock.getUserPerformance.mockResolvedValue({
      data: [],
      appliedRange: {
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        timezone: 'America/Bogota',
      },
    });

    await controller.getUserPerformance(
      mockUser,
      '2026-03-01',
      '2026-03-31',
      'false',
      ' user-1, user-2 ,,user-1 ',
    );

    expect(reportsServiceMock.getUserPerformance).toHaveBeenCalledWith(
      'org-1',
      '2026-03-01',
      '2026-03-31',
      false,
      ['user-1', 'user-2'],
    );
  });
});
