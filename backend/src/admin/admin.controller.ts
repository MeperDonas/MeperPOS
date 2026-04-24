import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationStatusDto } from './dto/update-organization-status.dto';
import { UpdateOrganizationPlanDto } from './dto/update-organization-plan.dto';
import { TransferPrimaryOwnerDto } from './dto/transfer-primary-owner.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('organizations')
  createOrganization(@Body() dto: CreateOrganizationDto) {
    return this.adminService.createOrganization(dto);
  }

  @Get('organizations')
  findAllOrganizations() {
    return this.adminService.findAllOrganizations();
  }

  @Get('organizations/:id')
  findOrganizationById(@Param('id') id: string) {
    return this.adminService.findOrganizationById(id);
  }

  @Patch('organizations/:id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrganizationStatusDto) {
    return this.adminService.updateStatus(id, dto);
  }

  @Patch('organizations/:id/plan')
  updatePlan(@Param('id') id: string, @Body() dto: UpdateOrganizationPlanDto) {
    return this.adminService.updatePlan(id, dto);
  }

  @Post('organizations/:id/transfer-owner')
  transferPrimaryOwner(
    @Param('id') organizationId: string,
    @Body() dto: TransferPrimaryOwnerDto,
  ) {
    return this.adminService.transferPrimaryOwner(
      organizationId,
      dto.currentOwnerId,
      dto.newOwnerId,
    );
  }

  @Get('metrics')
  getMetrics() {
    return this.adminService.getMetrics();
  }
}
