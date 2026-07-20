import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { OrgRole } from '@prisma/client';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrganizationRequiredGuard } from '../common/guards/organization-required.guard';
import { AdminOrganizationInterceptor } from '../common/interceptors/admin-organization.interceptor';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard, OrganizationRequiredGuard)
@UseInterceptors(AdminOrganizationInterceptor)
@Roles(OrgRole.ADMIN)
@ApiBearerAuth()
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  private parseUserIds(userIds?: string): string[] | undefined {
    if (!userIds) {
      return undefined;
    }

    const parsedUserIds = Array.from(
      new Set(
        userIds
          .split(',')
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      ),
    );

    return parsedUserIds.length > 0 ? parsedUserIds : undefined;
  }

  private parseCompare(compare?: string): boolean {
    if (!compare) {
      return true;
    }

    const normalized = compare.trim().toLowerCase();

    if (normalized === 'false' || normalized === '0') {
      return false;
    }

    return true;
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard KPIs' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getDashboard(
    @CurrentUser() user: RequestUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getDashboardKPIs(
      user.organizationId,
      startDate,
      endDate,
    );
  }

  @Get('sales/payment-method')
  @ApiOperation({ summary: 'Get sales by payment method' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getSalesByPaymentMethod(
    @CurrentUser() user: RequestUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getSalesByPaymentMethod(
      user.organizationId,
      startDate,
      endDate,
    );
  }

  @Get('sales/category')
  @ApiOperation({ summary: 'Get sales by category' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getSalesByCategory(
    @CurrentUser() user: RequestUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getSalesByCategory(
      user.organizationId,
      startDate,
      endDate,
    );
  }

  @Get('products/top-selling')
  @ApiOperation({ summary: 'Get top selling products' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  getTopSellingProducts(
    @CurrentUser() user: RequestUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportsService.getTopSellingProducts(
      user.organizationId,
      startDate,
      endDate,
      limit ? parseInt(limit) : 10,
    );
  }

  @Get('customers/statistics')
  @ApiOperation({ summary: 'Get customer statistics' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getCustomerStatistics(
    @CurrentUser() user: RequestUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getCustomerStatistics(
      user.organizationId,
      startDate,
      endDate,
    );
  }

  @Get('users/performance')
  @ApiOperation({ summary: 'Get user performance metrics' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'compare', required: false, example: true })
  @ApiQuery({
    name: 'userIds',
    required: false,
    description: 'Comma-separated user ids to compare with the same filters',
  })
  getUserPerformance(
    @CurrentUser() user: RequestUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('compare') compare?: string,
    @Query('userIds') userIds?: string,
  ) {
    return this.reportsService.getUserPerformance(
      user.organizationId,
      startDate,
      endDate,
      this.parseCompare(compare),
      this.parseUserIds(userIds),
    );
  }

  @Get('sales/daily')
  @ApiOperation({ summary: 'Get daily sales' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  getDailySales(
    @CurrentUser() user: RequestUser,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getDailySales(
      user.organizationId,
      startDate,
      endDate,
    );
  }
}
