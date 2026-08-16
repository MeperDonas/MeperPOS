import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsMigrationService } from './migration';
import { SettingsController } from './settings.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { OrganizationRequiredGuard } from '../common/guards/organization-required.guard';
import { AdminOrganizationInterceptor } from '../common/interceptors/admin-organization.interceptor';

@Module({
  imports: [CloudinaryModule],
  controllers: [SettingsController],
  providers: [
    SettingsService,
    SettingsMigrationService,
    OrganizationRequiredGuard,
    AdminOrganizationInterceptor,
  ],
  exports: [SettingsService, SettingsMigrationService],
})
export class SettingsModule {}
