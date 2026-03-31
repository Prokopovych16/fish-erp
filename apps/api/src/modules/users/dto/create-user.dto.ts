// DTO (Data Transfer Object) — описує які дані приймаємо від клієнта
// class-validator автоматично перевіряє кожне поле перед тим як потрапить в сервіс
import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @IsString() // має бути рядком
  name: string;

  @IsEmail() // має бути валідним email
  email: string;

  @IsString()
  @MinLength(6) // мінімум 6 символів
  password: string;

  @IsEnum(UserRole) // тільки значення з enum: ADMIN, WORKER, ACCOUNTANT, INSPECTOR
  role: UserRole;
}
