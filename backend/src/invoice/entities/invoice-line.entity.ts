import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Invoice } from './invoice.entity';

@Entity('invoice_lines')
export class InvoiceLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ type: 'varchar' })
  description: string;

  @Column({ type: 'varchar' })
  unit: string;

  @Column({ type: 'int', nullable: true })
  quantity: number | null;

  @Column({ name: 'unit_price', type: 'int', nullable: true })
  unitPrice: number | null;

  @Column({ type: 'int' })
  amount: number;

  @Column({ name: 'tax_code', type: 'varchar' })
  taxCode: string;
}
