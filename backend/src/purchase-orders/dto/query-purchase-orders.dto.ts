import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsInt,
  Min,
  IsString,
  IsEnum,
  IsUUID,
  IsDateString,
} from 'class-validator';

export class QueryPurchaseOrdersDto {
  @ApiProperty({ required: false, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiProperty({
    required: false,
    enum: ['DRAFT', 'PENDING', 'PARTIAL_RECEIVED', 'RECEIVED', 'CANCELLED'],
  })
  @IsOptional()
  @IsEnum(['DRAFT', 'PENDING', 'PARTIAL_RECEIVED', 'RECEIVED', 'CANCELLED'])
  status?: 'DRAFT' | 'PENDING' | 'PARTIAL_RECEIVED' | 'RECEIVED' | 'CANCELLED';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  q?: string;
}
