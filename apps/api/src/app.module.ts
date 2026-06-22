import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ProductsModule } from './modules/products/products.module';
import { WarehousesModule } from './modules/warehouses/warehouses.module';
import { OrdersModule } from './modules/orders/orders.module';
import { SettingsModule } from './modules/settings/settings.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { AuditModule } from './modules/audit/audit.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { ProductionCalcModule } from './modules/production-calc/production-calc.module';
import { ClientReturnsModule } from './modules/client-returns/client-returns.module';
import { CashModule } from './modules/cash/cash.module';
import { StoresModule } from './modules/stores/stores.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { SupplierInvoicesModule } from './modules/supplier-invoices/supplier-invoices.module';
import { RecipesModule } from './modules/recipes/recipes.module';
import { BomModule } from './modules/bom/bom.module';
import { ForecastModule } from './modules/forecast/forecast.module';
import { BazaarAssortmentModule } from './modules/bazaar-assortment/bazaar-assortment.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    ProductsModule,
    WarehousesModule,
    OrdersModule,
    SettingsModule,
    DocumentsModule,
    StatisticsModule,
    AuditModule,
    DriversModule,
    ProductionCalcModule,
    ClientReturnsModule,
    CashModule,
    StoresModule,
    TasksModule,
    SupplierInvoicesModule,
    RecipesModule,
    BomModule,
    ForecastModule,
    BazaarAssortmentModule,
  ],
})
export class AppModule {}
