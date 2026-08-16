import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  IsUUID,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'Product Name' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'SKU-001' })
  @IsString()
  sku: string;

  @ApiProperty({ example: '123456789', required: false })
  @IsString()
  @IsOptional()
  barcode?: string;

  @ApiProperty({ example: 'Product description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 100.0 })
  @IsNumber()
  @Min(0)
  costPrice: number;

  @ApiProperty({ example: 150.0 })
  @IsNumber()
  @Min(0)
  salePrice: number;

  @ApiProperty({ example: 19.0, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  taxRate?: number;

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  taxable?: boolean;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0)
  stock: number;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(0)
  minStock: number;

  @ApiProperty({ example: 'https://example.com/image.jpg', required: false })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ example: 'uuid-category-id' })
  @IsUUID('all')
  categoryId: string;
}

export class UpdateProductDto {
  @ApiProperty({ example: 'Product Name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'SKU-001', required: false })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiProperty({ example: '123456789', required: false })
  @IsString()
  @IsOptional()
  barcode?: string;

  @ApiProperty({ example: 'Product description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 100.0, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  costPrice?: number;

  @ApiProperty({ example: 150.0, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  salePrice?: number;

  @ApiProperty({ example: 19.0, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  taxRate?: number;

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  taxable?: boolean;

  @ApiProperty({ example: 10, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  stock?: number;

  @ApiProperty({ example: 5, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  minStock?: number;

  @ApiProperty({ example: 'https://example.com/image.jpg', required: false })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ example: 'uuid-category-id', required: false })
  @IsUUID('all')
  @IsOptional()
  categoryId?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
