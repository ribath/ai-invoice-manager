import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateInvoiceRecordDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  storagePath: string;

  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsNumber()
  fileSize: number;
}
