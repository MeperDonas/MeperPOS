import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsEnum,
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SaleItemDto {
  @ApiProperty({ example: 'uuid-product-id' })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity: number;

  @ApiProperty({ example: 150.0, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  unitPrice?: number;

  @ApiProperty({ example: 0, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  discountAmount?: number;
}

export class PaymentDto {
  @ApiProperty({ enum: ['CASH', 'CARD', 'TRANSFER'], example: 'CASH' })
  @IsEnum(['CASH', 'CARD', 'TRANSFER'])
  method: 'CASH' | 'CARD' | 'TRANSFER';

  @ApiProperty({ example: 100.0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount: number;
}

export class CreateSaleDto {
  @ApiProperty({ example: 'uuid-customer-id', required: false })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  customerId?: string;

  @ApiProperty({ type: [SaleItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @ApiProperty({ example: 0, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  discountAmount?: number;

  @ApiProperty({ type: [PaymentDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentDto)
  payments?: PaymentDto[];
}

export class UpdateSaleDto {
  @ApiProperty({
    enum: ['COMPLETED', 'CANCELLED', 'RETURNED_PARTIAL'],
    example: 'CANCELLED',
    required: false,
  })
  @IsEnum(['COMPLETED', 'CANCELLED', 'RETURNED_PARTIAL'])
  @IsOptional()
  status?: 'COMPLETED' | 'CANCELLED' | 'RETURNED_PARTIAL';

  @ApiProperty({ example: 'Cliente arrepentido', required: false })
  @IsString()
  @IsOptional()
  cancelReason?: string;
}

export class FindSalesQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ example: 'uuid-customer-id' })
  @IsString()
  @IsOptional()
  customerId?: string;
}
