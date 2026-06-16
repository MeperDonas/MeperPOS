import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { OrganizationRequiredGuard } from '../common/guards/organization-required.guard';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService, OrganizationRequiredGuard],
  exports: [CategoriesService],
})
export class CategoriesModule {}
