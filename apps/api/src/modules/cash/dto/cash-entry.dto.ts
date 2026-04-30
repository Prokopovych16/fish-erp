import { IsString, IsNumber, IsOptional, IsDateString, IsIn } from 'class-validator';

export const CASH_TYPES = [
  'INCOME',
  'EXPENSE',
  'SALARY_ME',
  'SALARY_PARTNER',
  'SALARY_ME_TAKE',
  'SALARY_PARTNER_TAKE',
  'PRODUCTION_FUND',
  'PRODUCTION_FUND_USE',
] as const;

export class CreateCashEntryDto {
  @IsDateString()
  date: string;

  @IsNumber()
  amount: number;

  @IsString()
  @IsIn(CASH_TYPES)
  type: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateCashEntryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  @IsIn(CASH_TYPES)
  type?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
