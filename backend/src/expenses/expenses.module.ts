import { Module } from '@nestjs/common';
import { OrganizationRequiredGuard } from '../common/guards/organization-required.guard';
import { AdminOrganizationInterceptor } from '../common/interceptors/admin-organization.interceptor';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

@Module({
  controllers: [ExpensesController],
  providers: [
    ExpensesService,
    OrganizationRequiredGuard,
    AdminOrganizationInterceptor,
  ],
  exports: [ExpensesService],
})
export class ExpensesModule {}
