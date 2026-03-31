import { IsOptional, IsString } from 'class-validator';

export class CreateClientDto {
  @IsString()
  name: string; // назва супермаркету або клієнта

  @IsOptional()
  @IsString()
  edrpou?: string; // ЄДРПОУ — необов'язковий

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  contact?: string; // телефон або email контактної особи
}
