import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsValidPassword } from '../../common/validators/password.policy';

export class ResetUserPasswordDto {
  @ApiProperty({
    example: 'correct-horse-battery-staple',
    description:
      'New password (min 10 chars, must not be a commonly breached password)',
    minLength: 10,
    maxLength: 128,
  })
  @IsString()
  @IsValidPassword()
  newPassword: string;
}
