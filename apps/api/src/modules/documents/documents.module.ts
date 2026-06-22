import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { SettingsModule } from '../settings/settings.module';
import { OrdersModule } from '../orders/orders.module';
import { SupplierInvoicesModule } from '../supplier-invoices/supplier-invoices.module';

@Module({
  imports: [SettingsModule, OrdersModule, SupplierInvoicesModule],
  providers: [DocumentsService],
  controllers: [DocumentsController],
})
export class DocumentsModule {}
