import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class QueryMonthDto {
  @ApiProperty({ example: '2026-08', pattern: '^\\d{4}-\\d{2}$' })
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'El formato del mes debe ser YYYY-MM',
  })
  month: string;
}
