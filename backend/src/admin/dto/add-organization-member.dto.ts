import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { OrgRole } from '@prisma/client';
import { IsValidPassword } from '../../common/validators/password.policy';

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
  @IsValidPassword()
  password?: string;
}
