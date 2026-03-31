import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Form } from '@prisma/client';

// Query параметри для фільтрації архіву
export class GetOrdersDto {
  @IsOptional()
  @IsEnum(Form)
  form?: Form; // фільтр по формі

  @IsOptional()
  @IsString()
  clientId?: string; // фільтр по клієнту

  @IsOptional()
  @IsString()
  from?: string; // дата від

  @IsOptional()
  @IsString()
  to?: string; // дата до

  @IsOptional()
  @IsString()
  number?: string; // номер накладної

  @IsOptional()
  @IsString()
  page?: string; // пагінація

  @IsOptional()
  @IsString()
  limit?: string;
}
