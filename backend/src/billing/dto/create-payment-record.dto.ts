import {
  IsString,
  IsNumber,
  IsDateString,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { PaymentMethod, PaymentRecordStatus } from '@prisma/client';

export class CreatePaymentRecordDto {
  @IsString()
  organizationId: string;

  @IsNumber()
  amount: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsDateString()
  @IsOptional()
  date?: string;

  @IsEnum(PaymentRecordStatus)
  @IsOptional()
  status?: PaymentRecordStatus;
}
