import { Injectable, Inject, Logger, HttpStatus } from '@nestjs/common';
import { AxiosInstance, AxiosError } from 'axios';
import { ACCOUNTING_HTTP_CLIENT } from '../common/http/accounting-http-client.provider';
import { AccountingApiException } from '../common/exceptions/accounting-api.exception';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

export interface Partner {
  partner_code: string;
  name: string;
  aliases: string[];
  registration_no: string;
}

export interface TaxCode {
  tax_code: string;
  rate: number;
  label: string;
}

export interface RegisteredInvoice {
  accounting_id: string;
  partner_code: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  line_count: number;
}

@Injectable()
export class AccountingClientService {
  private readonly logger = new Logger(AccountingClientService.name);

  constructor(
    @Inject(ACCOUNTING_HTTP_CLIENT)
    private readonly httpClient: AxiosInstance,
  ) {}

  async checkHealth(): Promise<{ status: string; registered_invoices: number }> {
    try {
      const response = await this.httpClient.get('/health');
      return response.data.data;
    } catch (error) {
      this.handleAxiosError(error, 'Failed to connect to accounting API health check');
    }
  }

  async getPartners(): Promise<{ partners: Partner[] }> {
    try {
      const response = await this.httpClient.get('/partners');
      return response.data.data;
    } catch (error) {
      this.handleAxiosError(error, 'Failed to fetch partners from accounting API');
    }
  }

  async getTaxCodes(): Promise<{ tax_codes: TaxCode[] }> {
    try {
      const response = await this.httpClient.get('/tax-codes');
      return response.data.data;
    } catch (error) {
      this.handleAxiosError(error, 'Failed to fetch tax codes from accounting API');
    }
  }

  async getRegisteredInvoices(): Promise<{ invoices: RegisteredInvoice[] }> {
    try {
      const response = await this.httpClient.get('/invoices');
      return response.data.data;
    } catch (error) {
      this.handleAxiosError(error, 'Failed to fetch invoices from accounting API');
    }
  }

  async registerInvoice(payload: CreateInvoiceDto): Promise<RegisteredInvoice> {
    try {
      const response = await this.httpClient.post('/invoices', payload);
      return response.data.data;
    } catch (error) {
      this.handleAxiosError(error, 'Failed to register invoice with accounting API');
    }
  }

  async resetInvoices(): Promise<{ removed: number }> {
    try {
      const response = await this.httpClient.delete('/invoices');
      return response.data.data;
    } catch (error) {
      this.handleAxiosError(error, 'Failed to reset invoices in accounting API');
    }
  }

  private handleAxiosError(error: any, fallbackMessage: string): never {
    const axiosError = error as AxiosError<any>;

    if (axiosError.response) {
      const { status, data } = axiosError.response;
      this.logger.warn(`Mock API Error [${status}]: ${JSON.stringify(data)}`);

      if (data && data.error) {
        throw new AccountingApiException(
          data.error.code || 'ACCOUNTING_API_ERROR',
          data.error.message || fallbackMessage,
          data.error.details || null,
          status,
        );
      }

      throw new AccountingApiException(
        'ACCOUNTING_API_ERROR',
        axiosError.message || fallbackMessage,
        data || null,
        status,
      );
    }

    if (axiosError.request) {
      const baseURL = this.httpClient.defaults.baseURL || 'accounting API';
      this.logger.error(`Accounting API unreachable at ${baseURL}: ${axiosError.message}`);
      throw new AccountingApiException(
        'MOCK_API_UNAVAILABLE',
        `Could not reach accounting API at ${baseURL}. Is the mock server running?`,
        { error: axiosError.message },
        HttpStatus.BAD_GATEWAY,
      );
    }

    throw new AccountingApiException(
      'INTERNAL_SERVER_ERROR',
      axiosError.message || fallbackMessage,
      null,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
