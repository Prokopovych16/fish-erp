import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule], // імпортуємо щоб мати доступ до AuditService
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
