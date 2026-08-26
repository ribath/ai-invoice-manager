import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

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
    return this.invoiceService.getRegisteredInvoices();
  }

  @Post('accounting/invoices')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async registerInvoice(@Body() createInvoiceDto: CreateInvoiceDto) {
    return this.invoiceService.registerInvoice(createInvoiceDto);
  }

  @Delete('accounting/invoices')
  async resetInvoices() {
    return this.invoiceService.resetInvoices();
  }
}
