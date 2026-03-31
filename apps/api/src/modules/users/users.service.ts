// Сервіс — тут вся бізнес-логіка
// Контролер приймає запит → передає в сервіс → сервіс працює з БД
import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, UpdatePasswordDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable() // дозволяє NestJS впроваджувати цей сервіс через DI (Dependency Injection)
export class UsersService {
  constructor(private prisma: PrismaService) {} // PrismaService впроваджується автоматично

  // Отримати всіх користувачів
  // select — вибираємо тільки потрібні поля, пароль НЕ повертаємо ніколи
  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }, // спочатку нові
    });
  }

  // Створити нового користувача
  async create(dto: CreateUserDto) {
    // Перевіряємо чи вже існує користувач з таким email
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Якщо існує — кидаємо помилку 409 Conflict
    if (existing)
      throw new ConflictException('Користувач з таким email вже існує');

    // Хешуємо пароль перед збереженням — в БД зберігається тільки хеш
    // 10 — це "salt rounds", чим більше тим безпечніше але повільніше
    const password = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: { ...dto, password }, // spread dto + замінюємо пароль на хешований
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        // password НЕ повертаємо
      },
    });
  }

  // Оновити ім'я або роль користувача
  async update(id: string, dto: UpdateUserDto) {
    await this.findOneOrFail(id); // перевіряємо що користувач існує

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  // Змінити пароль користувача
  async updatePassword(id: string, dto: UpdatePasswordDto) {
    await this.findOneOrFail(id);

    const password = await bcrypt.hash(dto.password, 10);

    await this.prisma.user.update({
      where: { id },
      data: { password },
    });

    return { message: 'Пароль змінено' };
  }

  // Активувати / деактивувати користувача
  // Ми не видаляємо користувачів фізично — тільки isActive: false
  async toggle(id: string) {
    const user = await this.findOneOrFail(id);

    return this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive }, // інвертуємо поточний стан
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });
  }

  // Приватний метод — використовується всередині сервісу
  // Знаходить користувача або кидає 404
  private async findOneOrFail(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Користувача не знайдено');
    return user;
  }
}
