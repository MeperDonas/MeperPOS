import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PlanType } from '@prisma/client';

class CreateAdminDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  @MinLength(6)
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
