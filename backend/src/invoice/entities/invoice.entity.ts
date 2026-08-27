import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { InvoiceLine } from './invoice-line.entity';

export enum InvoiceStatus {
  UPLOADED = 'UPLOADED',
  PROCESSING = 'PROCESSING',
  EXTRACTED = 'EXTRACTED',
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
  REGISTERED = 'REGISTERED',
  REGISTRATION_FAILED = 'REGISTRATION_FAILED',
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'file_name', type: 'varchar' })
  fileName: string;

  @Column({ name: 'storage_path', type: 'varchar' })
  storagePath: string;

  @Column({ name: 'mime_type', type: 'varchar' })
  mimeType: string;

  @Column({ name: 'file_size', type: 'int' })
  fileSize: number;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.PROCESSING,
  })
  status: InvoiceStatus;

  @Column({ name: 'extracted_data', type: 'jsonb', nullable: true })
  extractedData: Record<string, any> | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'accounting_id', type: 'varchar', nullable: true })
  accountingId: string | null;

  @Column({ name: 'partner_code', type: 'varchar', nullable: true })
  partnerCode: string | null;

  @Column({ name: 'invoice_number', type: 'varchar', nullable: true })
  invoiceNumber: string | null;

  @Column({ name: 'issue_date', type: 'date', nullable: true })
  issueDate: string | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ type: 'varchar', default: 'JPY' })
  currency: string;

  @Column({ type: 'int', nullable: true })
  subtotal: number | null;

  @Column({ name: 'tax_amount', type: 'int', nullable: true })
  taxAmount: number | null;

  @Column({ name: 'total_amount', type: 'int', nullable: true })
  totalAmount: number | null;

  @OneToMany(() => InvoiceLine, (line) => line.invoice, {
    cascade: true,
  })
  lines: InvoiceLine[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
