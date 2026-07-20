import { IsEnum } from 'class-validator';
import { PlanType } from '@prisma/client';

export class UpdateOrganizationPlanDto {
  @IsEnum(PlanType)
  plan: PlanType;
}
