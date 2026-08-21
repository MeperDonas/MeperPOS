import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { CustomersModule } from './customers/customers.module';
import { SalesModule } from './sales/sales.module';
import { ReportsModule } from './reports/reports.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SettingsModule } from './settings/settings.module';
import { ExportsModule } from './exports/exports.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { ImportsModule } from './imports/imports.module';
import { CacheModule } from './common/cache.module';
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { SequenceModule } from './common/sequences/sequence.module';
import { AdminModule } from './admin/admin.module';
import { PlanLimitsModule } from './plan-limits/plan-limits.module';
import { OrganizationStatusGuard } from './common/guards/organization-status.guard';
import { CookieCsrfGuard } from './common/guards/cookie-csrf.guard';
import { CashRegistersModule } from './cash-registers/cash-registers.module';
import { BillingModule } from './billing/billing.module';
import { ExpenseCategoriesModule } from './expenses/expense-categories.module';
import { ExpensesModule } from './expenses/expenses.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    CacheModule,
    PrismaModule,
    AuthModule,
    CategoriesModule,
    ProductsModule,
    CustomersModule,
    SalesModule,
    ReportsModule,
    SettingsModule,
    ExportsModule,
    CloudinaryModule,
    ImportsModule,
    UsersModule,
    TasksModule,
    SuppliersModule,
    PurchaseOrdersModule,
    SequenceModule,
    AdminModule,
    PlanLimitsModule,
    CashRegistersModule,
    BillingModule,
    ExpenseCategoriesModule,
    ExpensesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    OrganizationStatusGuard,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Guard placement: there is no global JwtAuthGuard in this app —
    // authentication resolves at route level via @UseGuards(JwtAuthGuard).
    // CookieCsrfGuard only inspects transport attributes (method, headers,
    // cookies, path) and never reads request.user, so it is safe to register
    // globally ahead of route-level authentication while still rejecting
    // cookie-authenticated mutations before any handler runs. Throttling
    // stays first so abusive traffic is shed before CSRF validation.
    {
      provide: APP_GUARD,
      useClass: CookieCsrfGuard,
    },
    {
      provide: APP_GUARD,
      useClass: OrganizationStatusGuard,
    },
  ],
})
export class AppModule {}
