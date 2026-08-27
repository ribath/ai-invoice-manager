import { Injectable, Logger } from '@nestjs/common';
import {
  AccountingClientService,
  Partner,
} from '../accounting-client.service';
import { ExtractedInvoiceData } from '../extraction/extraction-prompt';

export interface VerificationIssue {
  field: string;
  message: string;
  type: 'error' | 'warning';
  details?: Record<string, any>;
}

export interface VerificationResult {
  isValid: boolean;
  errors: VerificationIssue[];
  warnings: VerificationIssue[];
  suggestedPartner: {
    partner_code: string;
    name: string;
    matchType: 'registration_no' | 'name_exact' | 'alias' | 'fuzzy' | 'none';
    confidence: number;
  } | null;
  mathCheck: {
    calculatedSubtotal: number;
    subtotalMatches: boolean;
    taxByCode: Record<string, number>;
    calculatedTax: number;
    taxMatches: boolean;
    calculatedTotal: number;
    totalMatches: boolean;
  };
  isDuplicate: boolean;
}

const TAX_RATES: Record<string, number> = {
  T10: 0.1,
  T08: 0.08,
};

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(private readonly accountingClient: AccountingClientService) {}

  async verifyInvoiceData(
    data: ExtractedInvoiceData | Record<string, any>,
  ): Promise<VerificationResult> {
    const errors: VerificationIssue[] = [];
    const warnings: VerificationIssue[] = [];

    // 1. Math Verification
    const lines = Array.isArray(data.lines) ? data.lines : [];
    let calculatedSubtotal = 0;
    const subtotalByCode: Record<string, number> = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const amount = Number(line.amount) || 0;
      calculatedSubtotal += amount;

      const taxCode = line.tax_code || 'T10';
      if (!TAX_RATES[taxCode]) {
        errors.push({
          field: `lines[${i}].tax_code`,
          message: `Unknown tax code: "${taxCode}". Must be T10 or T08.`,
          type: 'error',
          details: { tax_code: taxCode },
        });
      } else {
        subtotalByCode[taxCode] = (subtotalByCode[taxCode] || 0) + amount;
      }

      // Check quantity * unitPrice if both exist
      if (
        line.quantity != null &&
        line.unit_price != null &&
        line.quantity * line.unit_price !== amount
      ) {
        warnings.push({
          field: `lines[${i}].amount`,
          message: `Line amount (${amount}) does not equal quantity (${line.quantity}) × unit price (${line.unit_price}) = ${line.quantity * line.unit_price}.`,
          type: 'warning',
        });
      }
    }

    const taxByCode: Record<string, number> = {};
    let calculatedTax = 0;

    for (const [code, subtotal] of Object.entries(subtotalByCode)) {
      const rate = TAX_RATES[code] || 0;
      const codeTax = Math.floor(subtotal * rate);
      taxByCode[code] = codeTax;
      calculatedTax += codeTax;
    }

    const calculatedTotal = calculatedSubtotal + calculatedTax;

    const subtotalMatches = Number(data.subtotal) === calculatedSubtotal;
    const taxMatches = Number(data.tax_amount) === calculatedTax;
    const totalMatches = Number(data.total_amount) === calculatedTotal;

    if (!subtotalMatches) {
      errors.push({
        field: 'subtotal',
        message: `Subtotal (${data.subtotal}) does not match the sum of line items (${calculatedSubtotal}).`,
        type: 'error',
        details: { expected: calculatedSubtotal, received: data.subtotal },
      });
    }

    if (!taxMatches) {
      errors.push({
        field: 'tax_amount',
        message: `Tax amount (${data.tax_amount}) does not match recalculated tax (${calculatedTax}) rounded down per tax code.`,
        type: 'error',
        details: { expected: calculatedTax, received: data.tax_amount, taxByCode },
      });
    }

    if (!totalMatches) {
      errors.push({
        field: 'total_amount',
        message: `Total amount (${data.total_amount}) does not match subtotal + tax (${calculatedTotal}).`,
        type: 'error',
        details: { expected: calculatedTotal, received: data.total_amount },
      });
    }

    // 2. Date Verification
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!data.issue_date || !dateRegex.test(data.issue_date)) {
      errors.push({
        field: 'issue_date',
        message: `Issue date is invalid or not in YYYY-MM-DD format: "${data.issue_date}".`,
        type: 'error',
      });
    }

    if (!data.due_date || !dateRegex.test(data.due_date)) {
      errors.push({
        field: 'due_date',
        message: `Due date is invalid or not in YYYY-MM-DD format: "${data.due_date}".`,
        type: 'error',
      });
    }

    if (
      data.issue_date &&
      data.due_date &&
      dateRegex.test(data.issue_date) &&
      dateRegex.test(data.due_date)
    ) {
      if (new Date(data.due_date) < new Date(data.issue_date)) {
        errors.push({
          field: 'due_date',
          message: `Due date (${data.due_date}) is earlier than issue date (${data.issue_date}).`,
          type: 'error',
        });
      }
    }

    // 3. Partner Matching
    let suggestedPartner: VerificationResult['suggestedPartner'] = null;
    let isDuplicate = false;

    try {
      const { partners } = await this.accountingClient.getPartners();
      suggestedPartner = this.matchPartner(
        partners,
        data.supplier_name,
        data.tax_registration_no,
      );

      if (!suggestedPartner) {
        warnings.push({
          field: 'partner_code',
          message: `Could not match supplier "${data.supplier_name}" to any partner in the accounting master.`,
          type: 'warning',
        });
      }

      // Check duplicate invoice number in registered invoices
      if (suggestedPartner && data.invoice_number) {
        try {
          const { invoices: registeredInvoices } =
            await this.accountingClient.getRegisteredInvoices();
          const dup = registeredInvoices.some(
            (inv) =>
              inv.partner_code === suggestedPartner?.partner_code &&
              inv.invoice_number === data.invoice_number,
          );
          if (dup) {
            isDuplicate = true;
            errors.push({
              field: 'invoice_number',
              message: `Invoice number "${data.invoice_number}" is already registered for partner ${suggestedPartner.partner_code} (${suggestedPartner.name}).`,
              type: 'error',
            });
          }
        } catch {
          // Non-blocking if mock API registered check fails
        }
      }
    } catch (err) {
      this.logger.warn(`Could not fetch partners for verification: ${err.message}`);
    }

    const isValid = errors.length === 0;

    return {
      isValid,
      errors,
      warnings,
      suggestedPartner,
      mathCheck: {
        calculatedSubtotal,
        subtotalMatches,
        taxByCode,
        calculatedTax,
        taxMatches,
        calculatedTotal,
        totalMatches,
      },
      isDuplicate,
    };
  }

  private matchPartner(
    partners: Partner[],
    supplierName?: string,
    registrationNo?: string | null,
  ): VerificationResult['suggestedPartner'] {
    if (!partners || partners.length === 0) return null;

    // 1. Match by registration number (T+13 digits)
    if (registrationNo) {
      const regMatch = partners.find(
        (p) =>
          p.registration_no &&
          p.registration_no.trim().toUpperCase() ===
            registrationNo.trim().toUpperCase(),
      );
      if (regMatch) {
        return {
          partner_code: regMatch.partner_code,
          name: regMatch.name,
          matchType: 'registration_no',
          confidence: 1.0,
        };
      }
    }

    if (!supplierName) return null;
    const cleanSupplier = this.normalizeName(supplierName);

    // 2. Exact match on partner name
    const exactMatch = partners.find(
      (p) => this.normalizeName(p.name) === cleanSupplier,
    );
    if (exactMatch) {
      return {
        partner_code: exactMatch.partner_code,
        name: exactMatch.name,
        matchType: 'name_exact',
        confidence: 0.99,
      };
    }

    // 3. Match against aliases
    for (const partner of partners) {
      if (partner.aliases) {
        for (const alias of partner.aliases) {
          if (this.normalizeName(alias) === cleanSupplier) {
            return {
              partner_code: partner.partner_code,
              name: partner.name,
              matchType: 'alias',
              confidence: 0.95,
            };
          }
        }
      }
    }

    // 4. Substring / Fuzzy match
    for (const partner of partners) {
      const normPartner = this.normalizeName(partner.name);
      if (
        normPartner.includes(cleanSupplier) ||
        cleanSupplier.includes(normPartner)
      ) {
        return {
          partner_code: partner.partner_code,
          name: partner.name,
          matchType: 'fuzzy',
          confidence: 0.85,
        };
      }
      if (partner.aliases) {
        for (const alias of partner.aliases) {
          const normAlias = this.normalizeName(alias);
          if (
            normAlias.includes(cleanSupplier) ||
            cleanSupplier.includes(normAlias)
          ) {
            return {
              partner_code: partner.partner_code,
              name: partner.name,
              matchType: 'fuzzy',
              confidence: 0.8,
            };
          }
        }
      }
    }

    return null;
  }

  private normalizeName(str: string): string {
    return str
      .replace(/[\s\u3000]/g, '')
      .replace(/株式会社|有限会社|合同会社/g, '')
      .toLowerCase();
  }
}
