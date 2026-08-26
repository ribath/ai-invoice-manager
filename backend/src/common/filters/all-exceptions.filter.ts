import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AxiosError } from 'axios';
import { AccountingApiException } from '../exceptions/accounting-api.exception';
import { ApiResponse } from '../interfaces/api-response.interface';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let details: any = null;

    if (exception instanceof AccountingApiException) {
      status = exception.getStatus();
      code = exception.errorDetail.code;
      message = exception.errorDetail.message;
      details = exception.errorDetail.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const errorObj = res as any;
        message = errorObj.message || exception.message;
        details = errorObj.details || (Array.isArray(errorObj.message) ? errorObj.message : null);
        code = errorObj.code || this.mapStatusToErrorCode(status);
      } else {
        code = this.mapStatusToErrorCode(status);
        message = exception.message;
      }
    } else if (this.isAxiosError(exception)) {
      const axiosError = exception as AxiosError<any>;
      if (axiosError.response) {
        status = axiosError.response.status;
        const responseData = axiosError.response.data;
        if (responseData && responseData.error) {
          code = responseData.error.code || 'MOCK_API_ERROR';
          message = responseData.error.message || axiosError.message;
          details = responseData.error.details || null;
        } else {
          code = this.mapStatusToErrorCode(status);
          message = axiosError.message;
          details = responseData;
        }
      } else if (axiosError.request) {
        status = HttpStatus.BAD_GATEWAY;
        code = 'MOCK_API_UNAVAILABLE';
        message = 'Could not connect to accounting system mock API';
        details = { error: axiosError.message };
      } else {
        message = axiosError.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const payload: ApiResponse = {
      success: false,
      data: null,
      error: {
        code,
        message: Array.isArray(message) ? message.join(', ') : message,
        details,
      },
    };

    response.status(status).json(payload);
  }

  private isAxiosError(error: any): boolean {
    return error && error.isAxiosError === true;
  }

  private mapStatusToErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'DUPLICATE_INVOICE';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'AMOUNT_MISMATCH';
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
