import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { OrganizationRequiredGuard } from '../common/guards/organization-required.guard';
import { AdminOrganizationInterceptor } from '../common/interceptors/admin-organization.interceptor';

@Module({
  imports: [PrismaModule],
  controllers: [TasksController],
  providers: [TasksService, OrganizationRequiredGuard, AdminOrganizationInterceptor],
  exports: [TasksService],
})
export class TasksModule {}
