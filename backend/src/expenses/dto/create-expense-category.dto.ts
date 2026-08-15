import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateExpenseCategoryDto {
  @ApiProperty({ example: 'Servicios públicos' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
