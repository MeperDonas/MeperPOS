import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { SupplierAccountType } from '@prisma/client';

export class CreateSupplierDto {
  @ApiProperty({ example: 'Distribuidora XYZ S.A.S.' })
  @IsString()
  name: string;

  @ApiProperty({ example: '900123456-7' })
  @IsString()
  documentNumber: string;

  @ApiProperty({ example: 'ventas@xyz.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '3001234567', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'Calle 123 #45-67', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ example: 'Juan Pérez', required: false })
  @IsString()
  @IsOptional()
  contactName?: string;

  @ApiProperty({ example: 'Bancolombia', required: false })
  @IsString()
  @IsOptional()
  bank?: string;

  @ApiProperty({ example: '1234567890', required: false })
  @IsString()
  @IsOptional()
  accountNumber?: string;

  @ApiProperty({ enum: SupplierAccountType, example: 'SAVINGS', required: false })
  @IsEnum(SupplierAccountType)
  @IsOptional()
  accountType?: SupplierAccountType;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
