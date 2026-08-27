import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { AccountingClientService } from './accounting-client.service';
import { AccountingHttpModule } from '../common/http/accounting-http.module';
import { Invoice } from './entities/invoice.entity';
import { InvoiceLine } from './entities/invoice-line.entity';
import { StorageModule } from '../common/storage/storage.module';
import { LlmModule } from '../common/llm/llm.module';
import { ExtractionService } from './extraction/extraction.service';
import { VerificationService } from './verification/verification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceLine]),
    AccountingHttpModule,
    StorageModule,
    LlmModule,
  ],
  controllers: [InvoiceController],
  providers: [
    InvoiceService,
    AccountingClientService,
    ExtractionService,
    VerificationService,
  ],
  exports: [
    InvoiceService,
    AccountingClientService,
    ExtractionService,
    VerificationService,
  ],
})
export class InvoiceModule {}
