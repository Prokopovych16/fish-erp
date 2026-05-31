import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class UpdateOrderItemDto {
  @IsString()
  itemId: string;

  @IsOptional()
  @IsNumber()
  @Min(0.001)
  actualWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerKg?: number;
}

export class UpdateItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderItemDto)
  items: UpdateOrderItemDto[];
}
