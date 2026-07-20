import { Module } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { SequenceModule } from '../common/sequences/sequence.module';
import { OrganizationRequiredGuard } from '../common/guards/organization-required.guard';
import { AdminOrganizationInterceptor } from '../common/interceptors/admin-organization.interceptor';

@Module({
  imports: [SequenceModule],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService, OrganizationRequiredGuard, AdminOrganizationInterceptor],
  exports: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
