import { IsString, IsEnum, IsOptional, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Form } from '@prisma/client';

class OrderItemDto {
  @IsString()
  productId: string;
  @IsNumber()
  @Min(0)
  plannedWeight: number;
  @IsOptional()
  @IsString()
  displayUnit?: string;
}

export class CreateOrderDto {
  @IsString()
  clientId: string;

  @IsEnum(Form)
  form: Form;

  @IsOptional()
  @IsString()
  plannedDate?: string;

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
  @IsNumber()
  numberForm?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items?: OrderItemDto[];

  @IsOptional()
  @IsString()
  invoiceDate?: string;
}
