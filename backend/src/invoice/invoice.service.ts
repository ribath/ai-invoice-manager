import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceLine } from './entities/invoice-line.entity';
import { CreateInvoiceRecordDto } from './dto/create-invoice-record.dto';
import { RegisterInvoiceDto } from './dto/register-invoice.dto';
import {
  AccountingClientService,
  Partner,
  TaxCode,
  RegisteredInvoice,
} from './accounting-client.service';
import { ExtractionService } from './extraction/extraction.service';
import {
  VerificationService,
  VerificationResult,
} from './verification/verification.service';
import { SupabaseStorageService } from '../common/storage/supabase-storage.service';

export interface InvoiceDetailResponse {
  invoice: Invoice;
  verification: VerificationResult;
  signedUrl: string;
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceLine)
    private readonly lineRepository: Repository<InvoiceLine>,
    private readonly accountingClient: AccountingClientService,
    private readonly extractionService: ExtractionService,
    private readonly verificationService: VerificationService,
    private readonly storageService: SupabaseStorageService,
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

  async getAccountingInvoices(): Promise<{ invoices: RegisteredInvoice[] }> {
    return this.accountingClient.getRegisteredInvoices();
  }

  async resetAccountingInvoices(): Promise<{ removed: number }> {
    return this.accountingClient.resetInvoices();
  }

  /**
   * Creates a new Invoice record from file metadata and triggers extraction synchronously.
   */
  async createAndExtract(dto: CreateInvoiceRecordDto): Promise<Invoice> {
    this.logger.log(`Creating invoice record for file: ${dto.fileName}`);

    const newInvoice = this.invoiceRepository.create({
      fileName: dto.fileName,
      storagePath: dto.storagePath,
      mimeType: dto.mimeType,
      fileSize: dto.fileSize,
      status: InvoiceStatus.PROCESSING,
    });

    const savedInvoice = await this.invoiceRepository.save(newInvoice);

    // Extract synchronously via LLM
    return this.extractionService.extractInvoiceData(savedInvoice.id);
  }

  /**
   * Lists all invoices in database.
   */
  async getInvoices(): Promise<Invoice[]> {
    return this.invoiceRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Fetches full invoice detail, generates signed preview URL, and runs verification checks.
   */
  async getInvoiceDetail(id: string): Promise<InvoiceDetailResponse> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id },
      relations: ['lines'],
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    // Get signed URL for browser preview
    let signedUrl = '';
    try {
      signedUrl = await this.storageService.getSignedUrl(
        invoice.storagePath,
        7200,
      );
    } catch (err) {
      this.logger.warn(`Could not generate preview signed URL: ${err.message}`);
      signedUrl = '';
    }

    // Run verification on extractedData or fallback
    const verification = await this.verificationService.verifyInvoiceData(
      invoice.extractedData || {},
    );

    return {
      invoice,
      verification,
      signedUrl,
    };
  }

  /**
   * Re-triggers extraction for an invoice.
   */
  async reExtractInvoice(id: string): Promise<Invoice> {
    return this.extractionService.extractInvoiceData(id);
  }

  /**
   * Registers a user-verified invoice to the Mock Accounting API and persists verified data.
   */
  async registerInvoice(
    id: string,
    dto: RegisterInvoiceDto,
  ): Promise<{ invoice: Invoice; accountingResult: RegisteredInvoice }> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id },
      relations: ['lines'],
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    try {
      this.logger.log(
        `Registering invoice ${id} (${dto.invoice_number}) with Mock Accounting API...`,
      );

      // Register with accounting system
      const accountingResult = await this.accountingClient.registerInvoice(
        dto as any,
      );

      // Delete existing lines if any
      if (invoice.lines && invoice.lines.length > 0) {
        await this.lineRepository.delete({ invoiceId: invoice.id });
      }

      // Create new verified lines
      const newLines = dto.lines.map((l) =>
        this.lineRepository.create({
          invoiceId: invoice.id,
          description: l.description,
          unit: l.unit,
          quantity: l.quantity ?? null,
          unitPrice: l.unit_price ?? null,
          amount: l.amount,
          taxCode: l.tax_code,
        }),
      );
      await this.lineRepository.save(newLines);

      // Update invoice fields
      invoice.status = InvoiceStatus.REGISTERED;
      invoice.accountingId = accountingResult.accounting_id;
      invoice.partnerCode = dto.partner_code;
      invoice.invoiceNumber = dto.invoice_number;
      invoice.issueDate = dto.issue_date;
      invoice.dueDate = dto.due_date;
      invoice.currency = dto.currency || 'JPY';
      invoice.subtotal = dto.subtotal;
      invoice.taxAmount = dto.tax_amount;
      invoice.totalAmount = dto.total_amount;
      invoice.errorMessage = null;

      const updatedInvoice = await this.invoiceRepository.save(invoice);
      updatedInvoice.lines = newLines;

      this.logger.log(
        `Successfully registered invoice ${id} -> ${accountingResult.accounting_id}`,
      );

      return {
        invoice: updatedInvoice,
        accountingResult,
      };
    } catch (error) {
      this.logger.error(
        `Registration failed for invoice ${id}: ${error.message}`,
      );
      invoice.status = InvoiceStatus.REGISTRATION_FAILED;
      invoice.errorMessage = error.message || 'Registration failed';
      await this.invoiceRepository.save(invoice);
      throw error;
    }
  }

  /**
   * Deletes an invoice record.
   */
  async deleteInvoice(id: string): Promise<{ success: boolean; id: string }> {
    const invoice = await this.invoiceRepository.findOne({ where: { id } });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    await this.invoiceRepository.delete(id);
    return { success: true, id };
  }
}
