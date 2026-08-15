import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { ExpenseCategoriesService } from './expense-categories.service';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';

@ApiTags('Expense Categories')
@Controller('expense-categories')
@UseGuards(JwtAuthGuard, RolesGuard, OrganizationRequiredGuard)
@UseInterceptors(AdminOrganizationInterceptor)
@ApiBearerAuth()
export class ExpenseCategoriesController {
  constructor(
    private readonly expenseCategoriesService: ExpenseCategoriesService,
  ) {}

  @Get()
  @Roles(OrgRole.ADMIN)
  @ApiOperation({ summary: 'Listar categorías de salidas de la organización' })
  findAll(@CurrentUser() user: RequestUser) {
    return this.expenseCategoriesService.findAll(user.organizationId);
  }

  @Post()
  @Roles(OrgRole.ADMIN)
  @ApiOperation({ summary: 'Crear una categoría de salidas' })
  create(
    @Body() dto: CreateExpenseCategoryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.expenseCategoriesService.create(dto, user.organizationId);
  }

  @Patch(':id')
  @Roles(OrgRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar una categoría de salidas' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseCategoryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.expenseCategoriesService.update(id, dto, user.organizationId);
  }

  @Delete(':id')
  @Roles(OrgRole.ADMIN)
  @ApiOperation({
    summary: 'Desactivar una categoría de salidas (borrado lógico)',
  })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.expenseCategoriesService.remove(id, user.organizationId);
  }
}
