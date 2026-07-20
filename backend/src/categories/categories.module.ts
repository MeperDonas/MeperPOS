import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { OrganizationRequiredGuard } from '../common/guards/organization-required.guard';
import { AdminOrganizationInterceptor } from '../common/interceptors/admin-organization.interceptor';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService, OrganizationRequiredGuard, AdminOrganizationInterceptor],
  exports: [CategoriesService],
})
export class CategoriesModule {}
