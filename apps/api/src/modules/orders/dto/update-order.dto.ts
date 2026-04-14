import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class UpdateOrderItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  productId: string;

  @IsNumber()
  @Min(0)
  plannedWeight: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  actualWeight?: number;

  @IsOptional()
  @IsString()
  displayUnit?: string;
}

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsNumber()
  numberForm?: number;

  @IsOptional()
  @IsString()
  driverName?: string;

  @IsOptional()
  @IsString()
  carNumber?: string;

  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsString()
  deliveryPointId?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  plannedDate?: string;

  @IsOptional()
  @IsString()
  invoiceDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderItemDto)
  items?: UpdateOrderItemDto[];
}
