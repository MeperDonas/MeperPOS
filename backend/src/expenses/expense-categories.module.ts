import { Module } from '@nestjs/common';
import { OrganizationRequiredGuard } from '../common/guards/organization-required.guard';
import { AdminOrganizationInterceptor } from '../common/interceptors/admin-organization.interceptor';
import { ExpenseCategoriesController } from './expense-categories.controller';
import { ExpenseCategoriesService } from './expense-categories.service';

@Module({
  controllers: [ExpenseCategoriesController],
  providers: [
    ExpenseCategoriesService,
    OrganizationRequiredGuard,
    AdminOrganizationInterceptor,
  ],
  exports: [ExpenseCategoriesService],
})
export class ExpenseCategoriesModule {}
