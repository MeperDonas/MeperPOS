import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class CreateCashRegisterDto {
  @IsString()
  name: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
