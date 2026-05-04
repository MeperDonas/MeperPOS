import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { OrgRole } from '@prisma/client';
import { SalesService } from './sales.service';
import {
  CreateSaleDto,
  FindSalesQueryDto,
  UpdateSaleDto,
} from './dto/sales.dto';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';

@ApiTags('Sales')
@Controller('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private salesService: SalesService) {}

  @Post()
  @Roles(OrgRole.ADMIN, OrgRole.MEMBER)
  @ApiOperation({ summary: 'Create a new sale' })
  create(
    @Body() createSaleDto: CreateSaleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.salesService.create(
      createSaleDto,
      user.userId,
      user.organizationId!,
    );
  }

  @Get()
  @Roles(OrgRole.ADMIN, OrgRole.MEMBER)
  @ApiOperation({ summary: 'Get all sales with pagination' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'customerId', required: false })
  findAll(@CurrentUser() user: RequestUser, @Query() query: FindSalesQueryDto) {
    const {
      page = 1,
      limit = 10,
      startDate,
      endDate,
      status,
      search,
      customerId,
    } = query;

    return this.salesService.findAll(
      user.organizationId!,
      page,
      limit,
      startDate,
      endDate,
      status,
      search,
      customerId,
      user,
    );
  }

  @Get('number/:saleNumber')
  @Roles(OrgRole.ADMIN, OrgRole.MEMBER)
  @ApiOperation({ summary: 'Find sale by sale number' })
  findBySaleNumber(
    @Param('saleNumber') saleNumber: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.salesService.findBySaleNumber(saleNumber, user);
  }

  @Get(':id')
  @Roles(OrgRole.ADMIN, OrgRole.MEMBER)
  @ApiOperation({ summary: 'Get a sale by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.salesService.findOne(id, user.organizationId!, user);
  }

  @Put(':id')
  @Roles(OrgRole.ADMIN)
  @ApiOperation({ summary: 'Update a sale' })
  update(
    @Param('id') id: string,
    @Body() updateSaleDto: UpdateSaleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.salesService.update(
      id,
      updateSaleDto,
      user.userId,
      user.organizationId!,
      user,
    );
  }

  @Post(':id/force-close')
  @Roles(OrgRole.ADMIN)
  @ApiOperation({ summary: 'Force close an open sale (PRO plan only)' })
  forceClose(
    @Param('id') id: string,
    @Body('reason') reason: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    return this.salesService.forceClose(id, user.organizationId!, reason);
  }

  @Post(':id/receipt')
  @Roles(OrgRole.ADMIN, OrgRole.MEMBER)
  @ApiOperation({ summary: 'Generate sale receipt PDF' })
  generateReceipt(
    @Param('id') id: string,
    @Res() res: Response,
    @CurrentUser() user: RequestUser,
  ) {
    return this.salesService.generateReceipt(id, res, user);
  }
}
