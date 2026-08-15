import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateExpenseCategoryDto {
  @ApiProperty({ required: false, example: 'Servicios públicos' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;
}
