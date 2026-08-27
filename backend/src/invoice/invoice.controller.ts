import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceRecordDto } from './dto/create-invoice-record.dto';
import { RegisterInvoiceDto } from './dto/register-invoice.dto';

@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  // --- Accounting Mock API Proxy Endpoints ---

  @Get('accounting/health')
  async getAccountingHealth() {
    return this.invoiceService.getAccountingHealth();
  }

  @Get('accounting/partners')
  async getPartners() {
    return this.invoiceService.getPartners();
  }

  @Get('accounting/tax-codes')
  async getTaxCodes() {
    return this.invoiceService.getTaxCodes();
  }

  @Get('accounting/invoices')
  async getRegisteredInvoices() {
    return this.invoiceService.getAccountingInvoices();
  }

  @Delete('accounting/invoices')
  async resetAccountingInvoices() {
    return this.invoiceService.resetAccountingInvoices();
  }

  // --- Invoice Intake Endpoints ---

  /**
   * Receives file metadata, saves invoice, and executes LLM extraction synchronously.
   */
  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async createAndExtractInvoice(@Body() dto: CreateInvoiceRecordDto) {
    return this.invoiceService.createAndExtract(dto);
  }

  /**
   * Lists all intake invoices.
   */
  @Get()
  async getInvoices() {
    return this.invoiceService.getInvoices();
  }

  /**
   * Retrieves full invoice detail along with real-time verification and signed preview URL.
   */
  @Get(':id')
  async getInvoiceDetail(@Param('id') id: string) {
    return this.invoiceService.getInvoiceDetail(id);
  }

  /**
   * Re-triggers Vision LLM extraction for an existing invoice.
   */
  @Post(':id/extract')
  @HttpCode(HttpStatus.OK)
  async reExtractInvoice(@Param('id') id: string) {
    return this.invoiceService.reExtractInvoice(id);
  }

  /**
   * Submits user-verified data to Mock Accounting API and updates invoice record.
   */
  @Post(':id/register')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async registerInvoice(
    @Param('id') id: string,
    @Body() dto: RegisterInvoiceDto,
  ) {
    return this.invoiceService.registerInvoice(id, dto);
  }

  /**
   * Deletes an invoice record.
   */
  @Delete(':id')
  async deleteInvoice(@Param('id') id: string) {
    return this.invoiceService.deleteInvoice(id);
  }
}
