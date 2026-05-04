import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class UpdateCashRegisterDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
