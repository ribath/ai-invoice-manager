const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface Partner {
  partner_code: string;
  name: string;
  aliases: string[];
  registration_no: string;
}

export interface TaxCode {
  tax_code: string;
  rate: number;
  label: string;
}

export interface InvoiceLineItem {
  id?: string;
  description: string;
  unit: string;
  quantity: number | null;
  unit_price?: number | null;
  unitPrice?: number | null;
  amount: number;
  tax_code?: string;
  taxCode?: string;
}

export interface InvoiceRecord {
  id: string;
  fileName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  status:
    | 'UPLOADED'
    | 'PROCESSING'
    | 'EXTRACTED'
    | 'EXTRACTION_FAILED'
    | 'REGISTERED'
    | 'REGISTRATION_FAILED';
  extractedData: {
    supplier_name?: string;
    tax_registration_no?: string | null;
    invoice_number?: string;
    issue_date?: string;
    due_date?: string;
    currency?: string;
    subtotal?: number;
    tax_amount?: number;
    total_amount?: number;
    lines?: InvoiceLineItem[];
    notes?: string | null;
    confidence_score?: number;
  } | null;
  errorMessage: string | null;
  accountingId: string | null;
  partnerCode: string | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
  subtotal: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  lines?: InvoiceLineItem[];
  createdAt: string;
  updatedAt: string;
}

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

export interface InvoiceDetailResponse {
  invoice: InvoiceRecord;
  verification: VerificationResult;
  signedUrl: string;
}

export interface RegisterInvoicePayload {
  partner_code: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  currency: string;
  lines: Array<{
    description: string;
    unit: string;
    quantity: number | null;
    unit_price: number | null;
    amount: number;
    tax_code: string;
  }>;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const text = await response.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid JSON response: ${text}`);
  }

  if (!response.ok) {
    const errorMsg =
      json?.message ||
      json?.error?.message ||
      json?.error ||
      `Request failed with status ${response.status}`;
    throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
  }

  // Unwrap { success: true, data: ..., error: null } envelope if present
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    return json.data as T;
  }

  return json as T;
}

export const api = {
  // Mock API / Accounting status
  getAccountingHealth: () =>
    request<{ status: string; registered_invoices: number }>(
      '/invoices/accounting/health',
    ),
  getPartners: () =>
    request<{ partners: Partner[] }>('/invoices/accounting/partners'),
  getTaxCodes: () =>
    request<{ tax_codes: TaxCode[] }>('/invoices/accounting/tax-codes'),
  getAccountingInvoices: () =>
    request<{ invoices: any[] }>('/invoices/accounting/invoices'),
  resetAccountingInvoices: () =>
    request<{ removed: number }>('/invoices/accounting/invoices', {
      method: 'DELETE',
    }),

  // Invoice intake
  getInvoices: () => request<InvoiceRecord[]>('/invoices'),
  createAndExtractInvoice: (metadata: {
    fileName: string;
    storagePath: string;
    mimeType: string;
    fileSize: number;
  }) =>
    request<InvoiceRecord>('/invoices', {
      method: 'POST',
      body: JSON.stringify(metadata),
    }),
  getInvoiceDetail: (id: string) =>
    request<InvoiceDetailResponse>(`/invoices/${id}`),
  reExtractInvoice: (id: string) =>
    request<InvoiceRecord>(`/invoices/${id}/extract`, {
      method: 'POST',
    }),
  registerInvoice: (id: string, payload: RegisterInvoicePayload) =>
    request<{ invoice: InvoiceRecord; accountingResult: any }>(
      `/invoices/${id}/register`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),
  deleteInvoice: (id: string) =>
    request<{ success: boolean; id: string }>(`/invoices/${id}`, {
      method: 'DELETE',
    }),
  resetAll: () =>
    request<{ success: boolean; message: string }>('/invoices/reset-all', {
      method: 'POST',
    }),
};
