import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PlanType } from '@prisma/client';
import { IsValidPassword } from '../../common/validators/password.policy';

class CreateAdminDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  @IsValidPassword()
  password?: string;
}

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  slug: string;

  @IsEnum(PlanType)
  @IsOptional()
  plan?: PlanType;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateAdminDto)
  admin?: CreateAdminDto;
}
