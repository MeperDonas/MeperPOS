import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PlanLimitsModule } from '../plan-limits/plan-limits.module';
import { OrganizationRequiredGuard } from '../common/guards/organization-required.guard';
import { AdminOrganizationInterceptor } from '../common/interceptors/admin-organization.interceptor';

@Module({
  imports: [PlanLimitsModule],
  controllers: [UsersController],
  providers: [UsersService, OrganizationRequiredGuard, AdminOrganizationInterceptor],
  exports: [UsersService],
})
export class UsersModule {}
