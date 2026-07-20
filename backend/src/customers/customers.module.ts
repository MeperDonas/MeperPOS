import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { PlanLimitsModule } from '../plan-limits/plan-limits.module';
import { OrganizationRequiredGuard } from '../common/guards/organization-required.guard';
import { AdminOrganizationInterceptor } from '../common/interceptors/admin-organization.interceptor';

@Module({
  imports: [PlanLimitsModule],
  controllers: [CustomersController],
  providers: [CustomersService, OrganizationRequiredGuard, AdminOrganizationInterceptor],
  exports: [CustomersService],
})
export class CustomersModule {}
