import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { OrganizationRequiredGuard } from '../common/guards/organization-required.guard';
import { AdminOrganizationInterceptor } from '../common/interceptors/admin-organization.interceptor';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, OrganizationRequiredGuard, AdminOrganizationInterceptor],
  exports: [ReportsService],
})
export class ReportsModule {}
