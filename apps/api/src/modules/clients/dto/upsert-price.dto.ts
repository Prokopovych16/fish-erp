import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Form } from '@prisma/client';

// Одна позиція прайсу
export class PriceItemDto {
  @IsString()
  productId: string; // id продукту

  @IsNumber()
  price: number; // ціна за кг

  @IsEnum(Form)
  form: Form; // FORM_1 або FORM_2
}

// Масив позицій — приймаємо одразу кілька цін за один запит
export class UpsertPricesDto {
  @IsArray()
  @ValidateNested({ each: true }) // валідуємо кожен елемент масиву
  @Type(() => PriceItemDto)
  prices: PriceItemDto[];
}
