import { IsEnum, IsOptional, IsString } from 'class-validator';
import { WarehouseType } from '@prisma/client';

export class CreateWarehouseDto {
  @IsString()
  name: string; // наприклад "Холодильник №1"

  @IsEnum(WarehouseType)
  type: WarehouseType; // RAW_MATERIAL / IN_PRODUCTION / FINISHED_GOODS / FRIDGE

  @IsOptional()
  @IsString()
  description?: string; // додатковий опис
}
