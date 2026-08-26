import { Module } from '@nestjs/common';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { AccountingClientService } from './accounting-client.service';
import { AccountingHttpModule } from '../common/http/accounting-http.module';

@Module({
  imports: [AccountingHttpModule],
  controllers: [InvoiceController],
  providers: [InvoiceService, AccountingClientService],
  exports: [InvoiceService, AccountingClientService],
})
export class InvoiceModule {}
