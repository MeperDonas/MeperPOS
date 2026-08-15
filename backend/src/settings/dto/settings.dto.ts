import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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
