import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { PlanLimitsModule } from '../plan-limits/plan-limits.module';

@Module({
  imports: [AuthModule, PlanLimitsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
