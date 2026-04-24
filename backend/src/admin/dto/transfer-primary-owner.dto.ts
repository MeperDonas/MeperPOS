import { IsUUID } from 'class-validator';

export class TransferPrimaryOwnerDto {
  @IsUUID()
  currentOwnerId: string;

  @IsUUID()
  newOwnerId: string;
}
