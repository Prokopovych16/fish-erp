import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { MovementType, Form } from '@prisma/client';

export class StockMovementDto {
  @IsString()
  warehouseId: string;

  @IsOptional()
  @IsString()
  toWarehouseId?: string;

  @IsString()
  productId: string;

  @IsEnum(MovementType)
  type: MovementType;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsEnum(Form)
  form: Form;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerKg?: number; // ціна з ПДВ за кг — тільки для надходження

  @IsOptional()
  @IsString()
  supplierId?: string;
}
