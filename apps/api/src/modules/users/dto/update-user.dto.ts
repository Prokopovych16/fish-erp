import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

// DTO для оновлення користувача — всі поля опціональні
// бо адмін може змінити тільки ім'я, або тільки роль
export class UpdateUserDto {
  @IsOptional() // поле не обов'язкове
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

// Окремий DTO для зміни пароля — щоб не змішувати з основними даними
export class UpdatePasswordDto {
  @IsString()
  @MinLength(6)
  password: string;
}
