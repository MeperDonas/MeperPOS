import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsBoolean,
} from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'CC' })
  @IsString()
  documentType: string;

  @ApiProperty({ example: '1234567890' })
  @IsString()
  documentNumber: string;

  @ApiProperty({ example: 'john@example.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '555-1234', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'Entrega en portería', required: false })
  @IsString()
  @IsOptional()
  referencia?: string;

  @ApiProperty({ example: 'ABC-123', required: false })
  @IsString()
  @IsOptional()
  placaMoto?: string;

  @ApiProperty({ example: '123 Main St', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({
    enum: ['VIP', 'FREQUENT', 'OCCASIONAL', 'INACTIVE'],
    example: 'OCCASIONAL',
    required: false,
  })
  @IsEnum(['VIP', 'FREQUENT', 'OCCASIONAL', 'INACTIVE'])
  @IsOptional()
  segment?: 'VIP' | 'FREQUENT' | 'OCCASIONAL' | 'INACTIVE';
}

export class UpdateCustomerDto {
  @ApiProperty({ example: 'John Doe', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'CC', required: false })
  @IsString()
  @IsOptional()
  documentType?: string;

  @ApiProperty({ example: '1234567890', required: false })
  @IsString()
  @IsOptional()
  documentNumber?: string;

  @ApiProperty({ example: 'john@example.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '555-1234', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'Entrega en portería', required: false })
  @IsString()
  @IsOptional()
  referencia?: string;

  @ApiProperty({ example: 'ABC-123', required: false })
  @IsString()
  @IsOptional()
  placaMoto?: string;

  @ApiProperty({ example: '123 Main St', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({
    enum: ['VIP', 'FREQUENT', 'OCCASIONAL', 'INACTIVE'],
    example: 'OCCASIONAL',
    required: false,
  })
  @IsEnum(['VIP', 'FREQUENT', 'OCCASIONAL', 'INACTIVE'])
  @IsOptional()
  segment?: 'VIP' | 'FREQUENT' | 'OCCASIONAL' | 'INACTIVE';

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
