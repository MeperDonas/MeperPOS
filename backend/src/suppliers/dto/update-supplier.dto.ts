import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsBoolean } from 'class-validator';

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
  bankAccountType?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  bankAccountNumber?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
