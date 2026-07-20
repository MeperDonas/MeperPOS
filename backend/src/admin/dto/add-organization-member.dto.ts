import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { OrgRole } from '@prisma/client';

export class AddOrganizationMemberDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsEnum(OrgRole)
  role: OrgRole;

  @IsString()
  @IsOptional()
  @MinLength(6)
  password?: string;
}
