import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceStatus } from '../entities/invoice.entity';
import { SupabaseStorageService } from '../../common/storage/supabase-storage.service';
import { LlmService } from '../../common/llm/llm.service';
import { ExtractedInvoiceData } from './extraction-prompt';

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    private readonly storageService: SupabaseStorageService,
    private readonly llmService: LlmService,
  ) {}

  /**
   * Generates a signed Supabase URL and passes it directly to the Vision LLM.
   * The backend never downloads the file binary — the LLM fetches it directly from the signed URL.
   */
  async extractInvoiceData(invoiceId: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);
    }

    try {
      this.logger.log(
        `Starting direct-URL extraction for invoice ID: ${invoiceId} (${invoice.fileName})`,
      );

      invoice.status = InvoiceStatus.PROCESSING;
      await this.invoiceRepository.save(invoice);

      // 1. Generate temporary Supabase signed URL
      const signedUrl = await this.storageService.getSignedUrl(
        invoice.storagePath,
        3600,
      );

      // 2. Pass signed URL directly to the Vision LLM (LLM fetches the file itself)
      const extractedData: ExtractedInvoiceData =
        await this.llmService.extractInvoiceFromDocument(
          signedUrl,
          invoice.mimeType,
        );

      invoice.extractedData = extractedData;
      invoice.status = InvoiceStatus.EXTRACTED;
      invoice.errorMessage = null;

      const savedInvoice = await this.invoiceRepository.save(invoice);
      this.logger.log(`Extraction succeeded for invoice ID: ${invoiceId}`);
      return savedInvoice;
    } catch (error: any) {
      this.logger.error(
        `Extraction failed for invoice ID ${invoiceId}: ${error.message}`,
      );
      invoice.status = InvoiceStatus.EXTRACTION_FAILED;
      invoice.errorMessage = error.message || 'LLM Extraction failed';
      return await this.invoiceRepository.save(invoice);
    }
  }
}
