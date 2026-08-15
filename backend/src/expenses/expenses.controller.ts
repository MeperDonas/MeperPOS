import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrgRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { OrganizationRequiredGuard } from '../common/guards/organization-required.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminOrganizationInterceptor } from '../common/interceptors/admin-organization.interceptor';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateExpensePaymentDto } from './dto/create-expense-payment.dto';
import { QueryExpensesDto } from './dto/query-expenses.dto';
import { QueryMonthDto } from './dto/query-month.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesService } from './expenses.service';

@ApiTags('Expenses')
@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard, OrganizationRequiredGuard)
@UseInterceptors(AdminOrganizationInterceptor)
@ApiBearerAuth()
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @Roles(OrgRole.ADMIN)
  @ApiOperation({ summary: 'Crear una salida con su primer pago' })
  create(@Body() dto: CreateExpenseDto, @CurrentUser() user: RequestUser) {
    return this.expensesService.create(dto, user.userId, user.organizationId);
  }

  @Get()
  @Roles(OrgRole.ADMIN)
  @ApiOperation({ summary: 'Listar salidas de la organización' })
  findAll(@Query() query: QueryExpensesDto, @CurrentUser() user: RequestUser) {
    return this.expensesService.findAll(query, user.organizationId);
  }

  @Get('summary/monthly')
  @Roles(OrgRole.ADMIN)
  @ApiOperation({ summary: 'Resumen mensual de salidas por categoría' })
  getMonthlySummary(
    @Query() query: QueryMonthDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.expensesService.getMonthlySummary(
      query.month,
      user.organizationId,
    );
  }

  @Get(':id')
  @Roles(OrgRole.ADMIN)
  @ApiOperation({ summary: 'Obtener una salida por ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.expensesService.findOne(id, user.organizationId);
  }

  @Patch(':id')
  @Roles(OrgRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar una salida' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.expensesService.update(
      id,
      dto,
      user.userId,
      user.organizationId,
    );
  }

  @Post(':id/payments')
  @Roles(OrgRole.ADMIN)
  @ApiOperation({ summary: 'Registrar un pago adicional a una salida' })
  addPayment(
    @Param('id') id: string,
    @Body() dto: CreateExpensePaymentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.expensesService.addPayment(
      id,
      dto,
      user.userId,
      user.organizationId,
    );
  }

  @Delete(':id')
  @Roles(OrgRole.ADMIN)
  @ApiOperation({ summary: 'Desactivar una salida (borrado lógico)' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.expensesService.remove(id, user.userId, user.organizationId);
  }
}
