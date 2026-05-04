import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PlanLimitsModule } from '../plan-limits/plan-limits.module';

@Module({
  imports: [PlanLimitsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
