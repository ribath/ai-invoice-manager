import { HttpException, HttpStatus } from '@nestjs/common';
import { ApiErrorDetail } from '../interfaces/api-response.interface';

export class AccountingApiException extends HttpException {
  public readonly errorDetail: ApiErrorDetail;

  constructor(
    code: string,
    message: string,
    details?: any,
    status: number = HttpStatus.BAD_REQUEST,
  ) {
    const errorDetail: ApiErrorDetail = { code, message, details: details ?? null };
    super(errorDetail, status);
    this.errorDetail = errorDetail;
  }
}
