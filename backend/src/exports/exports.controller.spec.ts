import { type ExecutionContext } from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { ExportsController } from './exports.controller';

describe('ExportsController (expenses route)', () => {
  const serviceMock = {
    exportExpenses: jest.fn(),
  };

  const adminUser: RequestUser = {
    userId: 'user-1',
    email: 'admin@example.com',
    organizationId: 'org-1',
    role: OrgRole.ADMIN,
    tokenVersion: 1,
    isSuperAdmin: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires ADMIN on the expenses export handler', () => {
    const controller = new ExportsController(serviceMock as never);

    expect(Reflect.getMetadata(ROLES_KEY, controller.exportExpenses)).toEqual([
      OrgRole.ADMIN,
    ]);
  });

  it('delegates exportExpenses with organizationId from the token and the query body', async () => {
    const controller = new ExportsController(serviceMock as never);
    const res = {} as Response;

    serviceMock.exportExpenses.mockResolvedValue(undefined);

    await controller.exportExpenses(
      adminUser,
      { format: 'excel', type: 'expenses' },
      res,
    );

    expect(serviceMock.exportExpenses).toHaveBeenCalledWith(
      'org-1',
      { format: 'excel', type: 'expenses' },
      res,
    );
  });
});
