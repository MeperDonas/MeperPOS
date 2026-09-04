import { Reflector } from '@nestjs/core';
import { OrgRole } from '@prisma/client';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { ExpenseTaxonomyController } from './expense-taxonomy.controller';

describe('ExpenseTaxonomyController', () => {
  it('protects every taxonomy mutation and query with ADMIN role metadata', () => {
    const controller = new ExpenseTaxonomyController({} as never);
    for (const handler of [controller.findGroups, controller.createGroup, controller.updateGroup, controller.removeGroup, controller.findLabels, controller.createLabel, controller.updateLabel, controller.removeLabel]) {
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([OrgRole.ADMIN]);
    }
  });

  it('passes organizationId from the authenticated user to the service', async () => {
    const service = { findGroups: jest.fn().mockResolvedValue([]), createGroup: jest.fn().mockResolvedValue({}) };
    const controller = new ExpenseTaxonomyController(service as never);
    const user = { organizationId: 'org-1' } as never;
    await controller.findGroups(user);
    await controller.createGroup({ name: 'Gastos' }, user);
    expect(service.findGroups).toHaveBeenCalledWith('org-1');
    expect(service.createGroup).toHaveBeenCalledWith({ name: 'Gastos' }, 'org-1');
  });
});
