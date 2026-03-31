import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { SettingsModule } from '../settings/settings.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [SettingsModule, OrdersModule],
  providers: [DocumentsService],
  controllers: [DocumentsController],
})
export class DocumentsModule {}
