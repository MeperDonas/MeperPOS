import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PlanLimitService } from './plan-limits.service';
import { LimitType } from './plan-limits.constants';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';

@ApiTags('Plan Limits')
@Controller('plan-limits')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PlanLimitsController {
  constructor(private readonly planLimitService: PlanLimitService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Get current plan limits usage for the organization',
  })
  async getStatus(@CurrentUser() user: RequestUser) {
    const organizationId = user.organizationId;

    if (!organizationId) {
      return {
        organizationId: null,
        limits: [],
      };
    }

    const types: LimitType[] = [
      'users',
      'products',
      'customers',
      'cashRegisters',
    ];

    const limits = await Promise.all(
      types.map((type) =>
        this.planLimitService.getLimitStatus(type, organizationId),
      ),
    );

    return {
      organizationId,
      limits,
    };
  }
}
