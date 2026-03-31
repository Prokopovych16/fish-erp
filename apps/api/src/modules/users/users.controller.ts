// Контролер — приймає HTTP запити і передає в сервіс
// Сам не містить логіки — тільки маршрутизація і захист
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, UpdatePasswordDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard) // всі маршрути захищені JWT і перевіркою ролі
@Roles(UserRole.ADMIN) // весь контролер доступний тільки ADMIN
@Controller('users') // базовий шлях: /api/users
export class UsersController {
  constructor(private usersService: UsersService) {}

  // GET /api/users — список всіх користувачів
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  // POST /api/users — створити нового користувача
  // @Body() — дістає тіло запиту і валідує через CreateUserDto
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  // PATCH /api/users/:id — змінити ім'я або роль
  // @Param('id') — дістає :id з URL
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  // PATCH /api/users/:id/password — змінити пароль
  @Patch(':id/password')
  updatePassword(@Param('id') id: string, @Body() dto: UpdatePasswordDto) {
    return this.usersService.updatePassword(id, dto);
  }

  // PATCH /api/users/:id/toggle — активувати або деактивувати
  @Patch(':id/toggle')
  toggle(@Param('id') id: string) {
    return this.usersService.toggle(id);
  }
}
