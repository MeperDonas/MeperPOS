import { Module } from '@nestjs/common';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { ProductsModule } from '../products/products.module';
import { SettingsModule } from '../settings/settings.module';
import { OrganizationRequiredGuard } from '../common/guards/organization-required.guard';
import { AdminOrganizationInterceptor } from '../common/interceptors/admin-organization.interceptor';

@Module({
  imports: [ProductsModule, SettingsModule],
  controllers: [ImportsController],
  providers: [ImportsService, OrganizationRequiredGuard, AdminOrganizationInterceptor],
})
export class ImportsModule {}
