import { Module } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller';
import { OrganizationRequiredGuard } from '../common/guards/organization-required.guard';
import { AdminOrganizationInterceptor } from '../common/interceptors/admin-organization.interceptor';

@Module({
  controllers: [SuppliersController],
  providers: [SuppliersService, OrganizationRequiredGuard, AdminOrganizationInterceptor],
  exports: [SuppliersService],
})
export class SuppliersModule {}
