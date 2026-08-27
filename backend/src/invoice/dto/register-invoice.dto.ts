import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class VerifiedInvoiceLineDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  unit: string;

  @IsInt()
  amount: number;

  @IsString()
  @IsIn(['T10', 'T08'], { message: 'tax_code must be T10 or T08' })
  tax_code: string;

  @IsOptional()
  @IsInt()
  quantity?: number | null;

  @IsOptional()
  @IsInt()
  unit_price?: number | null;
}

export class RegisterInvoiceDto {
  @IsString()
  @IsNotEmpty()
  partner_code: string;

  @IsString()
  @IsNotEmpty()
  invoice_number: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'issue_date must be formatted as YYYY-MM-DD',
  })
  issue_date: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'due_date must be formatted as YYYY-MM-DD',
  })
  due_date: string;

  @IsString()
  @IsIn(['JPY'], { message: 'Only JPY is supported' })
  currency: string = 'JPY';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VerifiedInvoiceLineDto)
  lines: VerifiedInvoiceLineDto[];

  @IsInt()
  subtotal: number;

  @IsInt()
  tax_amount: number;

  @IsInt()
  total_amount: number;
}
