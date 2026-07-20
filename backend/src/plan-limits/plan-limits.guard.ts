import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlanLimitService } from './plan-limits.service';
import { PLAN_LIMIT_KEY } from './plan-limits.decorator';
import { LimitType } from './plan-limits.constants';

@Injectable()
export class PlanLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private planLimitService: PlanLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const limitType = this.reflector.getAllAndOverride<LimitType>(
      PLAN_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!limitType) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // SuperAdmin bypass
    if (user?.isSuperAdmin || user?.role === 'SUPER_ADMIN') {
      return true;
    }

    const organizationId = user?.organizationId;

    if (!organizationId) {
      return true;
    }

    const { allowed, current, limit } = await this.planLimitService.checkLimit(
      limitType,
      organizationId,
    );

    if (!allowed) {
      throw new ForbiddenException({
        message: `Plan limit exceeded for ${limitType}`,
        limit,
        current,
        exceeded: true,
        type: limitType,
      });
    }

    return true;
  }
}
