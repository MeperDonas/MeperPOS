import { Module } from '@nestjs/common';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { MultiSheetImportService } from './multi-sheet-import.service';
import { TemplateService } from './template.service';
import { ProductsModule } from '../products/products.module';
import { CustomersModule } from '../customers/customers.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { UsersModule } from '../users/users.module';
import { PlanLimitsModule } from '../plan-limits/plan-limits.module';
import { OrganizationRequiredGuard } from '../common/guards/organization-required.guard';
import { AdminOrganizationInterceptor } from '../common/interceptors/admin-organization.interceptor';

@Module({
  imports: [
    ProductsModule,
    CustomersModule,
    SuppliersModule,
    UsersModule,
    PlanLimitsModule,
  ],
  controllers: [ImportsController],
  providers: [
    ImportsService,
    MultiSheetImportService,
    TemplateService,
    OrganizationRequiredGuard,
    AdminOrganizationInterceptor,
  ],
})
export class ImportsModule {}
