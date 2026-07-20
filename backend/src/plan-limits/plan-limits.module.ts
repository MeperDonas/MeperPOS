import { Module } from '@nestjs/common';
import { PlanLimitService } from './plan-limits.service';
import { PlanLimitGuard } from './plan-limits.guard';
import { PlanLimitsController } from './plan-limits.controller';

@Module({
  controllers: [PlanLimitsController],
  providers: [PlanLimitService, PlanLimitGuard],
  exports: [PlanLimitService, PlanLimitGuard],
})
export class PlanLimitsModule {}
