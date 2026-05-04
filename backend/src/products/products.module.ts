import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { SettingsModule } from '../settings/settings.module';
import { PlanLimitsModule } from '../plan-limits/plan-limits.module';

@Module({
  imports: [CloudinaryModule, SettingsModule, PlanLimitsModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
