// Модуль — збирає разом контролер і сервіс
// exports: [UsersService] — дозволяє іншим модулям використовувати UsersService
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  providers: [UsersService], // реєструємо сервіс
  controllers: [UsersController], // реєструємо контролер
  exports: [UsersService], // експортуємо сервіс для інших модулів
})
export class UsersModule {}
