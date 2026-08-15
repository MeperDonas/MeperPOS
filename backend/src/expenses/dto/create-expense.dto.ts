import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateExpensePaymentDto } from './create-expense-payment.dto';

export class CreateExpenseDto {
  @ApiProperty({ example: 'uuid-category-id' })
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional({ example: 'uuid-supplier-id' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ example: 'uuid-purchase-order-id' })
  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @ApiPropertyOptional({ example: 'Arriendo agosto' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: '2026-08-15' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 500000, minimum: 0.01 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  total: number;

  @ApiProperty({ type: [CreateExpensePaymentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateExpensePaymentDto)
  payments: CreateExpensePaymentDto[];
}
