import { Module } from '@nestjs/common';
import { CashRegistersService } from './cash-registers.service';
import { CashRegistersController } from './cash-registers.controller';
import { PlanLimitsModule } from '../plan-limits/plan-limits.module';

@Module({
  imports: [PlanLimitsModule],
  controllers: [CashRegistersController],
  providers: [CashRegistersService],
  exports: [CashRegistersService],
})
export class CashRegistersModule {}
