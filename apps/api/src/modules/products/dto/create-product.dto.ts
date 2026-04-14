import { IsOptional, IsString, IsInt, Min } from 'class-validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  category?: string;

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

  @IsOptional()
  @IsString()
  packagingType?: string;
}
