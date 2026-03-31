import { IsEnum } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class UpdateStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus; // PENDING / IN_PROGRESS / DONE / CANCELLED
}
