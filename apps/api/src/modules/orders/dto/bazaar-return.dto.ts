import { IsArray, IsNumber, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class BazaarReturnItemDto {
  @IsString()
  itemId: string;

  @IsNumber()
  @Min(0)
  returnedWeight: number;
}

export class BazaarReturnDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BazaarReturnItemDto)
  items: BazaarReturnItemDto[];
}
