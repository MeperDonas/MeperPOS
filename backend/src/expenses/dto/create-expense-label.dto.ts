import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateExpenseLabelDto {
  @IsUUID()
  groupId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
}
