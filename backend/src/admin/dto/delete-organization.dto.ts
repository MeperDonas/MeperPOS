import { IsNotEmpty, IsString } from 'class-validator';

export class DeleteOrganizationDto {
  @IsString()
  @IsNotEmpty()
  confirmOrganizationName: string;
}
