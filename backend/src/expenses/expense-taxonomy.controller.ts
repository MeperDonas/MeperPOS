import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OrgRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { OrganizationRequiredGuard } from '../common/guards/organization-required.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminOrganizationInterceptor } from '../common/interceptors/admin-organization.interceptor';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { ExpenseTaxonomyService } from './expense-taxonomy.service';
import { CreateExpenseGroupDto } from './dto/create-expense-group.dto';
import { UpdateExpenseGroupDto } from './dto/update-expense-group.dto';
import { CreateExpenseLabelDto } from './dto/create-expense-label.dto';
import { UpdateExpenseLabelDto } from './dto/update-expense-label.dto';

@ApiTags('Expense Taxonomy')
@ApiBearerAuth()
@Controller('expense-groups')
@UseGuards(JwtAuthGuard, RolesGuard, OrganizationRequiredGuard)
@UseInterceptors(AdminOrganizationInterceptor)
export class ExpenseTaxonomyController {
  constructor(private readonly service: ExpenseTaxonomyService) {}
  @Get() @Roles(OrgRole.ADMIN) findGroups(@CurrentUser() user: RequestUser) { return this.service.findGroups(user.organizationId); }
  @Post() @Roles(OrgRole.ADMIN) createGroup(@Body() dto: CreateExpenseGroupDto, @CurrentUser() user: RequestUser) { return this.service.createGroup(dto, user.organizationId); }
  @Patch(':id') @Roles(OrgRole.ADMIN) updateGroup(@Param('id') id: string, @Body() dto: UpdateExpenseGroupDto, @CurrentUser() user: RequestUser) { return this.service.updateGroup(id, dto, user.organizationId); }
  @Delete(':id') @Roles(OrgRole.ADMIN) removeGroup(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.service.removeGroup(id, user.organizationId); }
  @Get(':groupId/labels') @Roles(OrgRole.ADMIN) findLabels(@Param('groupId') groupId: string, @CurrentUser() user: RequestUser) { return this.service.findLabels(groupId, user.organizationId); }
  @Post(':groupId/labels') @Roles(OrgRole.ADMIN) createLabel(@Param('groupId') groupId: string, @Body() dto: Omit<CreateExpenseLabelDto, 'groupId'>, @CurrentUser() user: RequestUser) { return this.service.createLabel({ ...dto, groupId }, user.organizationId); }
  @Patch(':groupId/labels/:id') @Roles(OrgRole.ADMIN) updateLabel(@Param('groupId') groupId: string, @Param('id') id: string, @Body() dto: UpdateExpenseLabelDto, @CurrentUser() user: RequestUser) { return this.service.updateLabel(id, dto, user.organizationId, groupId); }
  @Delete(':groupId/labels/:id') @Roles(OrgRole.ADMIN) removeLabel(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.service.removeLabel(id, user.organizationId); }
}
