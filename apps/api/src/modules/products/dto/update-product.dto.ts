import { IsOptional, IsString, IsInt, Min } from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  storageTemp?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  storageDays?: number;

  @IsOptional()
  @IsString()
  storageHumidity?: string;

  @IsOptional()
  @IsString()
  storageStandard?: string;
}
