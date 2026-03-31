import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

// Фактична вага яку вписує працівник
export class UpdateOrderItemDto {
  @IsString()
  itemId: string; // id позиції заявки

  @IsNumber()
  @Min(0.001)
  actualWeight: number; // фактична вага після зважування
}

export class UpdateItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderItemDto)
  items: UpdateOrderItemDto[];
}
