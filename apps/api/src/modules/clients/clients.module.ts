import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';

@Module({
  providers: [ClientsService],
  controllers: [ClientsController],
  exports: [ClientsService], // експортуємо бо OrdersModule буде використовувати ціни
})
export class ClientsModule {}
