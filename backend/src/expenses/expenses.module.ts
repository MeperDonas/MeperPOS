import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { OrganizationRequiredGuard } from '../common/guards/organization-required.guard';
import { AdminOrganizationInterceptor } from '../common/interceptors/admin-organization.interceptor';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { ExpenseTaxonomyController } from './expense-taxonomy.controller';
import { ExpenseTaxonomyService } from './expense-taxonomy.service';

@Module({
  imports: [CloudinaryModule],
  controllers: [ExpensesController, ExpenseTaxonomyController],
  providers: [
    ExpensesService,
    ExpenseTaxonomyService,
    OrganizationRequiredGuard,
    AdminOrganizationInterceptor,
  ],
  exports: [ExpensesService, ExpenseTaxonomyService],
})
export class ExpensesModule {}
