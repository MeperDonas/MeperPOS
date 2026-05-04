import { SetMetadata } from '@nestjs/common';
import { LimitType } from './plan-limits.constants';

export const PLAN_LIMIT_KEY = 'plan_limit';

export const PlanLimit = (type: LimitType) => SetMetadata(PLAN_LIMIT_KEY, type);
