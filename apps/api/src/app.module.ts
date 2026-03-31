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
  ],
})
export class AppModule {}
