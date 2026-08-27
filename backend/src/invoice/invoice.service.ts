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

    if (
      dto.issue_date &&
      dto.due_date &&
      new Date(dto.due_date) < new Date(dto.issue_date)
    ) {
      throw new BadRequestException(
        `Due date (${dto.due_date}) cannot be earlier than issue date (${dto.issue_date}).`,
      );
    }

    try {
      this.logger.log(
        `Registering invoice ${id} (${dto.invoice_number}) with Mock Accounting API...`,
      );

      // 1. Register with accounting system
      const accountingResult = await this.accountingClient.registerInvoice(
        dto as any,
      );

      // 2. Update invoice header fields in DB
      await this.invoiceRepository.update(id, {
        status: InvoiceStatus.REGISTERED,
        accountingId: accountingResult.accounting_id,
        partnerCode: dto.partner_code,
        invoiceNumber: dto.invoice_number,
        issueDate: dto.issue_date,
        dueDate: dto.due_date,
        currency: dto.currency || 'JPY',
        subtotal: dto.subtotal,
        taxAmount: dto.tax_amount,
        totalAmount: dto.total_amount,
        errorMessage: null,
      });

      // 3. Delete existing lines if any
      await this.lineRepository.delete({ invoiceId: id });

      // 4. Insert new verified lines directly
      if (dto.lines && dto.lines.length > 0) {
        await this.lineRepository
          .createQueryBuilder()
          .insert()
          .into(InvoiceLine)
          .values(
            dto.lines.map((l) => ({
              invoiceId: id,
              description: l.description,
              unit: l.unit,
              quantity: l.quantity ?? null,
              unitPrice: l.unit_price ?? null,
              amount: l.amount,
              taxCode: l.tax_code,
            })),
          )
          .execute();
      }

      const updatedInvoice = await this.invoiceRepository.findOne({
        where: { id },
        relations: ['lines'],
      });

      this.logger.log(
        `Successfully registered invoice ${id} -> ${accountingResult.accounting_id}`,
      );

      return {
        invoice: updatedInvoice!,
        accountingResult,
      };
    } catch (error) {
      const statusCode =
        error.status ||
        error.statusCode ||
        (typeof error.getStatus === 'function' ? error.getStatus() : null) ||
        error.response?.status ||
        error.response?.statusCode ||
        'UNKNOWN_STATUS';

      this.logger.error(
        `Registration failed for invoice ${id} [Status ${statusCode}]: ${error.message}`,
      );
      await this.invoiceRepository.update(id, {
        status: InvoiceStatus.REGISTRATION_FAILED,
        errorMessage: error.message || 'Registration failed',
      });
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
