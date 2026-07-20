import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingScheduler } from './billing.scheduler';
import { PaymentRecordsService } from './payment-records.service';
import { OrganizationRequiredGuard } from '../common/guards/organization-required.guard';
import { AdminOrganizationInterceptor } from '../common/interceptors/admin-organization.interceptor';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [BillingController],
  providers: [BillingService, BillingScheduler, PaymentRecordsService, OrganizationRequiredGuard, AdminOrganizationInterceptor],
  exports: [BillingService, PaymentRecordsService],
})
export class BillingModule {}
