import { Injectable } from '@nestjs/common';
import {
  AccountingClientService,
  Partner,
  TaxCode,
  RegisteredInvoice,
} from './accounting-client.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

@Injectable()
export class InvoiceService {
  constructor(
    private readonly accountingClient: AccountingClientService,
  ) {}

  async getAccountingHealth(): Promise<{ status: string; registered_invoices: number }> {
    return this.accountingClient.checkHealth();
  }

  async getPartners(): Promise<{ partners: Partner[] }> {
    return this.accountingClient.getPartners();
  }

  async getTaxCodes(): Promise<{ tax_codes: TaxCode[] }> {
    return this.accountingClient.getTaxCodes();
  }

  async getRegisteredInvoices(): Promise<{ invoices: RegisteredInvoice[] }> {
    return this.accountingClient.getRegisteredInvoices();
  }

  async registerInvoice(dto: CreateInvoiceDto): Promise<RegisteredInvoice> {
    return this.accountingClient.registerInvoice(dto);
  }

  async resetInvoices(): Promise<{ removed: number }> {
    return this.accountingClient.resetInvoices();
  }
}
