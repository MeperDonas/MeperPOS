import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrgRole } from '@prisma/client';
import { PaymentRecordsService } from './payment-records.service';
import { BillingService } from './billing.service';
import { CreatePaymentRecordDto } from './dto/create-payment-record.dto';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';

@ApiTags('Billing')
@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BillingController {
  constructor(
    private readonly paymentRecordsService: PaymentRecordsService,
    private readonly billingService: BillingService,
  ) {}

  @Get('payments')
  @Roles(OrgRole.ADMIN, OrgRole.OWNER)
  @ApiOperation({ summary: 'Get payment history for current organization' })
  async getPayments(@CurrentUser() user: RequestUser) {
    return this.paymentRecordsService.findAllByOrg(user.organizationId!);
  }

  @Post('payments')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Register a payment (SUPER_ADMIN only)' })
  async createPayment(@Body() dto: CreatePaymentRecordDto) {
    return this.paymentRecordsService.create(dto);
  }

  @Get('status')
  @Roles(OrgRole.ADMIN, OrgRole.CASHIER, OrgRole.INVENTORY_USER)
  @ApiOperation({ summary: 'Get current billing status' })
  async getStatus(@CurrentUser() user: RequestUser) {
    return this.billingService.getStatus(user.organizationId!);
  }
}
