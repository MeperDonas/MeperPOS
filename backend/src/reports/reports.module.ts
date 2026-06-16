import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { OrganizationRequiredGuard } from '../common/guards/organization-required.guard';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, OrganizationRequiredGuard],
  exports: [ReportsService],
})
export class ReportsModule {}
