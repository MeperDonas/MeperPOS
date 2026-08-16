import { IsString, IsOptional, IsObject, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOrganizationNameDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdateReceiptPrefixDto {
  @ApiPropertyOptional({ example: 'REC-' })
  @IsString()
  @IsOptional()
  prefix?: string;
}

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 'Empresa ABC - Comprobante #' })
  @IsString()
  @IsOptional()
  printHeader?: string;

  @ApiPropertyOptional({ example: 'Pague en efectivo. Gracias por su compra.' })
  @IsString()
  @IsOptional()
  printFooter?: string;

  @ApiPropertyOptional({ example: { theme: 'dark' } })
  @IsObject()
  @IsOptional()
  custom?: Record<string, unknown>;
}
