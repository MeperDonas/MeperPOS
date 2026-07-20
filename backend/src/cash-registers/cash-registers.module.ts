import { Module } from '@nestjs/common';
import { CashRegistersService } from './cash-registers.service';
import { CashRegistersController } from './cash-registers.controller';
import { PlanLimitsModule } from '../plan-limits/plan-limits.module';
import { OrganizationRequiredGuard } from '../common/guards/organization-required.guard';
import { AdminOrganizationInterceptor } from '../common/interceptors/admin-organization.interceptor';

@Module({
  imports: [PlanLimitsModule],
  controllers: [CashRegistersController],
  providers: [CashRegistersService, OrganizationRequiredGuard, AdminOrganizationInterceptor],
  exports: [CashRegistersService],
})
export class CashRegistersModule {}
