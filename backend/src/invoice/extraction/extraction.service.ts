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
   * Includes automatic retry logic: if the initial extraction fails, it retries once more.
   */
  async extractInvoiceData(invoiceId: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);
    }

    invoice.status = InvoiceStatus.PROCESSING;
    await this.invoiceRepository.save(invoice);

    const maxAttempts = 2;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.logger.log(
          `Starting direct-URL extraction for invoice ID: ${invoiceId} (${invoice.fileName}) [Attempt ${attempt}/${maxAttempts}]`,
        );

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
        this.logger.log(
          `Extraction succeeded on attempt ${attempt} for invoice ID: ${invoiceId}`,
        );
        return savedInvoice;
      } catch (error: any) {
        lastError = error;
        this.logger.warn(
          `Extraction attempt ${attempt}/${maxAttempts} failed for invoice ${invoiceId}: ${error.message}`,
        );

        if (attempt < maxAttempts) {
          this.logger.log(
            `Retrying extraction for invoice ID: ${invoiceId} in 1500ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    }

    // If all retry attempts fail:
    this.logger.error(
      `All ${maxAttempts} extraction attempts failed for invoice ID ${invoiceId}: ${lastError?.message}`,
    );
    invoice.status = InvoiceStatus.EXTRACTION_FAILED;
    invoice.errorMessage = lastError?.message || 'LLM Extraction failed after retry';
    return await this.invoiceRepository.save(invoice);
  }
}
