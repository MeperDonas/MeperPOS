import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentRecordDto } from './dto/create-payment-record.dto';
import { PaymentRecordStatus, OrgStatus, BillingStatus } from '@prisma/client';

@Injectable()
export class PaymentRecordsService {
  constructor(private prisma: PrismaService) {}

  async findAllByOrg(organizationId: string) {
    return this.prisma.paymentRecord.findMany({
      where: { organizationId },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    return this.prisma.paymentRecord.findFirst({
      where: { id, organizationId },
    });
  }

  async create(dto: CreatePaymentRecordDto) {
    const record = await this.prisma.paymentRecord.create({
      data: {
        organizationId: dto.organizationId,
        amount: dto.amount,
        method: dto.method,
        date: dto.date ? new Date(dto.date) : new Date(),
        status: dto.status ?? PaymentRecordStatus.PAID,
      },
    });

    // If payment is successful, reactivate organization
    if (record.status === PaymentRecordStatus.PAID) {
      await this.prisma.organization.update({
        where: { id: dto.organizationId },
        data: {
          status: OrgStatus.ACTIVE,
          billingStatus: BillingStatus.PAID,
        },
      });
    }

    return record;
  }
}
