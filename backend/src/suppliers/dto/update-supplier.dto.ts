import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { SupplierAccountType } from '@prisma/client';

export class UpdateSupplierDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  documentNumber?: string;

  @ApiProperty({ required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  contactName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  accountNumber?: string;

  @ApiProperty({ enum: SupplierAccountType, required: false })
  @IsEnum(SupplierAccountType)
  @IsOptional()
  accountType?: SupplierAccountType;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
