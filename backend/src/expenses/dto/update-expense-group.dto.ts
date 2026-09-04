import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateExpenseGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;
}
