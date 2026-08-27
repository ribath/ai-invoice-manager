import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  ExtractedInvoiceData,
  INVOICE_EXTRACTION_SYSTEM_PROMPT,
} from '../../invoice/extraction/extraction-prompt';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private geminiKey: string | null = null;

  constructor(private readonly configService: ConfigService) {
    const rawGemini = this.configService.get<string>('GEMINI_API_KEY');

    if (
      rawGemini &&
      !rawGemini.includes('your-gemini') &&
      rawGemini.trim() !== ''
    ) {
      this.geminiKey = rawGemini.trim();
      this.logger.log('Google Gemini Vision LLM initialized successfully.');
    } else {
      this.logger.warn(
        'GEMINI_API_KEY not configured or set to placeholder.',
      );
    }
  }

  /**
   * Main method: Passes the document's temporary signed URL directly to Google Gemini Vision.
   * The backend does NOT download the binary — Gemini fetches the document directly from Supabase.
   */
  async extractInvoiceFromDocument(
    signedUrl: string,
    mimeType: string,
  ): Promise<ExtractedInvoiceData> {
    this.logger.log(
      `Calling Google Gemini Vision with signed URL for ${mimeType}`,
    );

    if (!signedUrl || signedUrl.includes('placeholder')) {
      this.logger.warn('No valid signed URL provided. Using placeholder.');
      return this.generatePlaceholderExtraction();
    }

    if (this.geminiKey) {
      try {
        const response = await axios.post(
          'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
          {
            model: 'gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: INVOICE_EXTRACTION_SYSTEM_PROMPT,
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Please analyze this Japanese invoice document and extract all fields into the required JSON schema.',
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: signedUrl,
                    },
                  },
                ],
              },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.geminiKey}`,
            },
            timeout: 60000,
          },
        );

        const content = response.data?.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response received from Gemini Vision');
        }

        return this.parseAndSanitizeJson(content);
      } catch (error: any) {
        const errDetail = error.response?.data
          ? JSON.stringify(error.response.data)
          : error.message;
        this.logger.error(`Gemini Vision URL extraction failed: ${errDetail}`);
        throw new Error(`LLM Extraction failed: ${errDetail}`);
      }
    }

    this.logger.warn(
      'No active GEMINI_API_KEY configured. Using structured placeholder output.',
    );
    return this.generatePlaceholderExtraction();
  }

  private parseAndSanitizeJson(text: string): ExtractedInvoiceData {
    let clean = text.trim();
    if (clean.startsWith('```json')) {
      clean = clean.substring(7);
    } else if (clean.startsWith('```')) {
      clean = clean.substring(3);
    }
    if (clean.endsWith('```')) {
      clean = clean.substring(0, clean.length - 3);
    }
    clean = clean.trim();

    try {
      const raw = JSON.parse(clean);

      // Normalize fields between raw prompt schema and ExtractedInvoiceData interface
      const supplier_name =
        raw.supplier_name_raw || raw.supplier_name || 'Unknown Supplier';
      const tax_registration_no =
        raw.supplier_registration_no || raw.tax_registration_no || null;
      const invoice_number =
        raw.invoice_number || `INV-${Math.floor(1000 + Math.random() * 9000)}`;
      const issue_date =
        raw.issue_date || new Date().toISOString().split('T')[0];
      const due_date =
        raw.due_date ||
        new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
      const currency = raw.currency || 'JPY';

      const rawLines = Array.isArray(raw.lines) ? raw.lines : [];
      const lines = rawLines.map((l: any) => {
        let taxCode = 'T10';
        if (l.tax_code === 'T08' || l.tax_rate_printed === '8%') {
          taxCode = 'T08';
        }
        return {
          description: l.description || 'Line Item',
          unit: l.unit || '式',
          quantity: l.quantity != null ? Number(l.quantity) : null,
          unit_price: l.unit_price != null ? Number(l.unit_price) : null,
          amount: Number(l.amount) || 0,
          tax_code: taxCode as 'T10' | 'T08',
        };
      });

      // Calculate totals if missing
      const subtotal =
        raw.subtotal != null
          ? Number(raw.subtotal)
          : lines.reduce((acc: number, cur: any) => acc + cur.amount, 0);

      const tax_amount =
        raw.tax_amount != null
          ? Number(raw.tax_amount)
          : Math.floor(subtotal * 0.1);

      const total_amount =
        raw.total_amount != null
          ? Number(raw.total_amount)
          : subtotal + tax_amount;

      const notes =
        raw.confidence?.notes || raw.notes || null;

      let confidence_score = 0.95;
      if (raw.confidence?.overall === 'medium') confidence_score = 0.75;
      if (raw.confidence?.overall === 'low') confidence_score = 0.5;

      return {
        supplier_name,
        tax_registration_no,
        invoice_number,
        issue_date,
        due_date,
        currency,
        subtotal,
        tax_amount,
        total_amount,
        lines,
        notes,
        confidence_score,
      };
    } catch (err: any) {
      this.logger.error(`Failed to parse LLM JSON: ${clean}`);
      throw new Error(`Invalid JSON format from LLM: ${err.message}`);
    }
  }

  private generatePlaceholderExtraction(): ExtractedInvoiceData {
    return {
      supplier_name: '株式会社山田製作所',
      tax_registration_no: 'T1010001000101',
      invoice_number: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      issue_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      currency: 'JPY',
      subtotal: 100000,
      tax_amount: 10000,
      total_amount: 110000,
      lines: [
        {
          description: '商品・サービス費',
          unit: '式',
          quantity: 1,
          unit_price: 100000,
          amount: 100000,
          tax_code: 'T10',
        },
      ],
      notes: 'Placeholder extraction. Add GEMINI_API_KEY to .env for live OCR.',
      confidence_score: 0.95,
    };
  }
}
