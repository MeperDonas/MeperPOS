import {
  Controller,
  Get,
  Put,
  Post,
  Patch,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { OrgRole } from '@prisma/client';
import { SettingsService } from './settings.service';
import {
  UpdateSettingsDto,
  UpdateOrganizationNameDto,
  UpdateReceiptPrefixDto,
} from './dto/settings.dto';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrganizationRequiredGuard } from '../common/guards/organization-required.guard';
import { AdminOrganizationInterceptor } from '../common/interceptors/admin-organization.interceptor';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard, OrganizationRequiredGuard)
@UseInterceptors(AdminOrganizationInterceptor)
@ApiBearerAuth()
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  @Roles(OrgRole.ADMIN)
  @ApiOperation({ summary: 'Get current system settings' })
  async getSettings(@CurrentUser() user: RequestUser) {
    return this.settingsService.find(user.organizationId);
  }

  @Get('default')
  @Roles(OrgRole.ADMIN)
  @ApiOperation({ summary: 'Get default settings values' })
  getDefaultSettings() {
    return this.settingsService.getDefaultSettings();
  }

  @Put()
  @Roles(OrgRole.ADMIN)
  @ApiOperation({ summary: 'Update system settings' })
  async updateSettings(
    @Body() updateSettingsDto: UpdateSettingsDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.settingsService.update(user.organizationId, updateSettingsDto);
  }

  @Post('logo')
  @Roles(OrgRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload company logo' })
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
  ) {
    return this.settingsService.uploadLogo(user.organizationId, file);
  }

  @Patch('organization')
  @Roles(OrgRole.ADMIN)
  @ApiOperation({ summary: 'Update organization name' })
  async updateOrganizationName(
    @Body() updateOrganizationNameDto: UpdateOrganizationNameDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.settingsService.updateOrganizationName(
      user.organizationId,
      updateOrganizationNameDto.name,
    );
  }

  @Patch('receipt-prefix')
  @Roles(OrgRole.ADMIN)
  @ApiOperation({ summary: 'Update receipt prefix' })
  async updateReceiptPrefix(
    @Body() updateReceiptPrefixDto: UpdateReceiptPrefixDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.settingsService.updateSalePrefix(
      user.organizationId,
      updateReceiptPrefixDto.prefix,
    );
  }
}
