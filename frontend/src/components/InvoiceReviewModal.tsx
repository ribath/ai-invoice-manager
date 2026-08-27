'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  Plus,
  Trash2,
  RefreshCw,
  Sparkles,
  Building2,
  Calendar,
  Hash,
  Send,
  FileText,
  HelpCircle,
  Maximize2,
} from 'lucide-react';
import {
  api,
  InvoiceDetailResponse,
  Partner,
  TaxCode,
  InvoiceLineItem,
} from '../lib/api';

interface InvoiceReviewModalProps {
  invoiceId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const InvoiceReviewModal: React.FC<InvoiceReviewModalProps> = ({
  invoiceId,
  onClose,
  onSuccess,
}) => {
  const [data, setData] = useState<InvoiceDetailResponse | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReExtracting, setIsReExtracting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any | null>(null);

  // Form State
  const [partnerCode, setPartnerCode] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState('JPY');
  const [lines, setLines] = useState<InvoiceLineItem[]>([]);

  useEffect(() => {
    loadDetails();
  }, [invoiceId]);

  const loadDetails = async () => {
    setIsLoading(true);
    setFormError(null);
    try {
      const [detailRes, partnersRes, taxCodesRes] = await Promise.all([
        api.getInvoiceDetail(invoiceId),
        api.getPartners().catch(() => ({ partners: [] })),
        api.getTaxCodes().catch(() => ({ tax_codes: [] })),
      ]);

      setData(detailRes);
      setPartners(partnersRes.partners || []);
      setTaxCodes(taxCodesRes.tax_codes || []);

      const inv = detailRes.invoice;
      const ext = inv.extractedData || {};
      const ver = detailRes.verification;

      // Populate form state from verified columns or fallback to extractedData
      const initialPartner =
        inv.partnerCode ||
        ver.suggestedPartner?.partner_code ||
        partnersRes.partners?.[0]?.partner_code ||
        'P-1001';

      setPartnerCode(initialPartner);
      setInvoiceNumber(inv.invoiceNumber || ext.invoice_number || '');
      setIssueDate(
        inv.issueDate ||
          ext.issue_date ||
          new Date().toISOString().split('T')[0],
      );
      setDueDate(
        inv.dueDate ||
          ext.due_date ||
          new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      );
      setCurrency(inv.currency || ext.currency || 'JPY');

      // Populate line items
      if (inv.lines && inv.lines.length > 0) {
        setLines(
          inv.lines.map((l) => ({
            description: l.description,
            unit: l.unit,
            quantity: l.quantity,
            unit_price: l.unitPrice ?? l.unit_price ?? null,
            amount: l.amount,
            tax_code: l.taxCode || l.tax_code || 'T10',
          })),
        );
      } else if (ext.lines && ext.lines.length > 0) {
        setLines(
          ext.lines.map((l: any) => ({
            description: l.description || '',
            unit: l.unit || '式',
            quantity: l.quantity != null ? Number(l.quantity) : null,
            unit_price: l.unit_price != null ? Number(l.unit_price) : null,
            amount: Number(l.amount) || 0,
            tax_code: l.tax_code || 'T10',
          })),
        );
      } else {
        setLines([
          {
            description: '商品・サービス費',
            unit: '式',
            quantity: 1,
            unit_price: ext.subtotal || 0,
            amount: ext.subtotal || 0,
            tax_code: 'T10',
          },
        ]);
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to load invoice details');
    } finally {
      setIsLoading(false);
    }
  };

  // Dynamic Math Recalculation
  const calculateTotals = () => {
    let subtotal = 0;
    const subtotalByCode: Record<string, number> = {};

    lines.forEach((l) => {
      const amt = Math.round(Number(l.amount) || 0);
      subtotal += amt;
      const code = l.tax_code || 'T10';
      subtotalByCode[code] = (subtotalByCode[code] || 0) + amt;
    });

    let taxAmount = 0;
    const taxBreakdown: Record<string, { subtotal: number; tax: number }> = {};

    Object.entries(subtotalByCode).forEach(([code, codeSub]) => {
      const rate = code === 'T08' ? 0.08 : 0.1;
      const codeTax = Math.floor(codeSub * rate);
      taxAmount += codeTax;
      taxBreakdown[code] = { subtotal: codeSub, tax: codeTax };
    });

    const totalAmount = subtotal + taxAmount;
    return { subtotal, taxAmount, totalAmount, taxBreakdown };
  };

  const { subtotal, taxAmount, totalAmount, taxBreakdown } = calculateTotals();

  // Line Item Handlers
  const handleLineChange = (
    index: number,
    field: keyof InvoiceLineItem,
    value: any,
  ) => {
    setLines((prev) => {
      const updated = [...prev];
      const target = { ...updated[index], [field]: value };

      // Auto-compute amount if quantity and unit_price are changed
      if (
        (field === 'quantity' || field === 'unit_price') &&
        target.quantity != null &&
        target.unit_price != null
      ) {
        target.amount = Math.round(target.quantity * target.unit_price);
      }

      updated[index] = target;
      return updated;
    });
  };

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        description: '',
        unit: '個',
        quantity: 1,
        unit_price: 0,
        amount: 0,
        tax_code: 'T10',
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReExtract = async () => {
    setIsReExtracting(true);
    setFormError(null);
    try {
      await api.reExtractInvoice(invoiceId);
      await loadDetails();
    } catch (err: any) {
      setFormError(err.message || 'Re-extraction failed');
    } finally {
      setIsReExtracting(false);
    }
  };

  const handleRegister = async () => {
    setIsSubmitting(true);
    setFormError(null);

    // Validation checks
    if (!partnerCode) {
      setFormError('Please select a Partner Code');
      setIsSubmitting(false);
      return;
    }
    if (!invoiceNumber.trim()) {
      setFormError('Invoice Number cannot be empty');
      setIsSubmitting(false);
      return;
    }
    if (lines.length === 0) {
      setFormError('Invoice must contain at least one line item');
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        partner_code: partnerCode,
        invoice_number: invoiceNumber.trim(),
        issue_date: issueDate,
        due_date: dueDate,
        currency: 'JPY',
        lines: lines.map((l) => ({
          description: l.description.trim() || 'Item',
          unit: l.unit.trim() || '式',
          quantity: l.quantity != null ? Math.round(l.quantity) : null,
          unit_price: l.unit_price != null ? Math.round(l.unit_price) : null,
          amount: Math.round(Number(l.amount) || 0),
          tax_code: l.tax_code || 'T10',
        })),
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
      };

      const result = await api.registerInvoice(invoiceId, payload);
      setSuccessResult(result.accountingResult);
      onSuccess();
    } catch (err: any) {
      console.error('Registration failed:', err);
      setFormError(err.message || 'Failed to register invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentPartner = partners.find((p) => p.partner_code === partnerCode);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container review-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-header-left">
            <Sparkles className="text-primary" size={20} />
            <div>
              <h2 className="modal-title">
                Invoice Review & Verification
              </h2>
              <p className="modal-subtitle">
                {data?.invoice.fileName} • ID: {invoiceId.substring(0, 8)}...
              </p>
            </div>
          </div>

          <div className="modal-header-right">
            {data?.invoice.status === 'REGISTERED' && (
              <span className="badge badge-success">
                <CheckCircle2 size={12} />
                Registered ({data.invoice.accountingId})
              </span>
            )}
            <button className="btn-icon" onClick={onClose} title="Close Modal">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body: Split Screen */}
        <div className="modal-body-split">
          {isLoading ? (
            <div className="modal-loading">
              <RefreshCw size={32} className="spin text-primary mb-3" />
              <p>Loading invoice data and verification checks...</p>
            </div>
          ) : (
            <>
              {/* LEFT PANE: Document Preview */}
              <div className="pane-left">
                <div className="pane-header">
                  <div className="pane-title-wrap">
                    <FileText size={16} />
                    <span>Original Document Preview</span>
                  </div>
                  {data?.signedUrl && (
                    <a
                      href={data.signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="pane-link"
                    >
                      <ExternalLink size={13} />
                      Open Full Size
                    </a>
                  )}
                </div>

                <div className="preview-container">
                  {data?.signedUrl && !data.signedUrl.includes('placeholder') ? (
                    data.invoice.mimeType.includes('pdf') ? (
                      <iframe
                        src={`${data.signedUrl}#toolbar=0&navpanes=0`}
                        title="PDF Preview"
                        className="preview-iframe"
                      />
                    ) : (
                      <div className="preview-img-wrap">
                        <img
                          src={data.signedUrl}
                          alt="Invoice Preview"
                          className="preview-image"
                        />
                      </div>
                    )
                  ) : (
                    <div className="preview-placeholder">
                      <FileText size={48} className="text-muted mb-2" />
                      <h4>{data?.invoice.fileName}</h4>
                      <p className="text-sm text-muted">
                        Storage Path: <code>{data?.invoice.storagePath}</code>
                      </p>
                      <div className="extracted-data-summary">
                        <h5>Raw AI Extracted Fields</h5>
                        <pre>
                          {JSON.stringify(data?.invoice.extractedData, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT PANE: Verification & Form */}
              <div className="pane-right">
                {/* Success Banner */}
                {successResult && (
                  <div className="alert-banner alert-success mb-4">
                    <CheckCircle2 size={20} />
                    <div>
                      <strong>Successfully Registered!</strong>
                      <p>
                        Assigned Accounting ID:{' '}
                        <code>{successResult.accounting_id}</code> for partner{' '}
                        <strong>{successResult.partner_code}</strong>.
                      </p>
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {formError && (
                  <div className="alert-banner alert-danger mb-4">
                    <AlertCircle size={20} />
                    <div>
                      <strong>Registration Error:</strong>
                      <p>{formError}</p>
                    </div>
                  </div>
                )}

                {/* Verification Summary Banner */}
                {data?.verification && (
                  <div className="verification-card mb-4">
                    <div className="verification-header">
                      <span className="text-xs uppercase font-semibold text-muted">
                        AI Verification Checks
                      </span>
                      {data.verification.isValid ? (
                        <span className="badge badge-success">
                          <CheckCircle2 size={12} />
                          Math & Schema Valid
                        </span>
                      ) : (
                        <span className="badge badge-danger">
                          <AlertTriangle size={12} />
                          Discrepancies Detected
                        </span>
                      )}
                    </div>

                    {/* Partner Matching Chip */}
                    {data.verification.suggestedPartner && (
                      <div className="partner-match-badge">
                        <Building2 size={14} />
                        <span>
                          Supplier match: <strong>{data.verification.suggestedPartner.name}</strong> ({data.verification.suggestedPartner.partner_code})
                        </span>
                        <span className="match-confidence">
                          {data.verification.suggestedPartner.matchType} (
                          {Math.round(
                            data.verification.suggestedPartner.confidence * 100,
                          )}
                          %)
                        </span>
                      </div>
                    )}

                    {/* Errors List */}
                    {data.verification.errors.length > 0 && (
                      <div className="verification-issues errors">
                        {data.verification.errors.map((err, i) => (
                          <div key={i} className="issue-row">
                            <AlertCircle size={14} className="text-danger" />
                            <span>{err.message}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Warnings List */}
                    {data.verification.warnings.length > 0 && (
                      <div className="verification-issues warnings">
                        {data.verification.warnings.map((warn, i) => (
                          <div key={i} className="issue-row">
                            <AlertTriangle size={14} className="text-warning" />
                            <span>{warn.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Invoice Form */}
                <div className="form-section">
                  <h3 className="section-title">Invoice Header Details</h3>

                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">
                        <Building2 size={14} />
                        Supplier (Partner Master) *
                      </label>
                      <select
                        value={partnerCode}
                        onChange={(e) => setPartnerCode(e.target.value)}
                        className="form-select"
                      >
                        <option value="">-- Select Partner --</option>
                        {partners.map((p) => (
                          <option key={p.partner_code} value={p.partner_code}>
                            [{p.partner_code}] {p.name} (
                            {p.registration_no || 'No Reg #'})
                          </option>
                        ))}
                      </select>
                      {currentPartner && (
                        <span className="form-helper">
                          Registration: {currentPartner.registration_no}
                        </span>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Hash size={14} />
                        Invoice Number (請求書番号) *
                      </label>
                      <input
                        type="text"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="e.g. YM-2026-0107"
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="form-grid-3 mt-3">
                    <div className="form-group">
                      <label className="form-label">
                        <Calendar size={14} />
                        Issue Date (発行日) *
                      </label>
                      <input
                        type="date"
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Calendar size={14} />
                        Due Date (お支払期日) *
                      </label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Currency</label>
                      <input
                        type="text"
                        value={currency}
                        readOnly
                        disabled
                        className="form-input disabled"
                      />
                    </div>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="form-section mt-5">
                  <div className="section-header-flex">
                    <h3 className="section-title">
                      Line Items (明細) ({lines.length})
                    </h3>
                    <button
                      className="btn btn-xs btn-secondary"
                      onClick={handleAddLine}
                    >
                      <Plus size={12} />
                      Add Line
                    </button>
                  </div>

                  <div className="table-responsive lines-table-wrap">
                    <table className="lines-table">
                      <thead>
                        <tr>
                          <th>Description (品名・摘要)</th>
                          <th style={{ width: '65px' }}>Unit</th>
                          <th style={{ width: '65px' }}>Qty</th>
                          <th style={{ width: '85px' }}>Unit Price</th>
                          <th style={{ width: '95px' }}>Amount (JPY)</th>
                          <th style={{ width: '75px' }}>Tax</th>
                          <th style={{ width: '35px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line, idx) => (
                          <tr key={idx}>
                            <td>
                              <input
                                type="text"
                                value={line.description}
                                onChange={(e) =>
                                  handleLineChange(
                                    idx,
                                    'description',
                                    e.target.value,
                                  )
                                }
                                placeholder="Description"
                                className="line-input"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={line.unit}
                                onChange={(e) =>
                                  handleLineChange(
                                    idx,
                                    'unit',
                                    e.target.value,
                                  )
                                }
                                placeholder="式"
                                className="line-input text-center"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                value={line.quantity ?? ''}
                                onChange={(e) =>
                                  handleLineChange(
                                    idx,
                                    'quantity',
                                    e.target.value === ''
                                      ? null
                                      : Number(e.target.value),
                                  )
                                }
                                placeholder="—"
                                className="line-input text-right"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                value={line.unit_price ?? ''}
                                onChange={(e) =>
                                  handleLineChange(
                                    idx,
                                    'unit_price',
                                    e.target.value === ''
                                      ? null
                                      : Number(e.target.value),
                                  )
                                }
                                placeholder="—"
                                className="line-input text-right"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                value={line.amount}
                                onChange={(e) =>
                                  handleLineChange(
                                    idx,
                                    'amount',
                                    Number(e.target.value),
                                  )
                                }
                                className="line-input text-right font-medium"
                              />
                            </td>
                            <td>
                              <select
                                value={line.tax_code}
                                onChange={(e) =>
                                  handleLineChange(
                                    idx,
                                    'tax_code',
                                    e.target.value,
                                  )
                                }
                                className="line-select text-center"
                              >
                                <option value="T10">10% (T10)</option>
                                <option value="T08">8% (T08)</option>
                              </select>
                            </td>
                            <td>
                              <button
                                className="btn-icon-xs text-muted hover-danger"
                                onClick={() => handleRemoveLine(idx)}
                                disabled={lines.length <= 1}
                                title="Remove Line"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Calculation Breakdown & Total Box */}
                <div className="totals-card mt-4">
                  <div className="totals-row">
                    <span className="totals-label">Subtotal (小計):</span>
                    <span className="totals-value">
                      ¥{subtotal.toLocaleString()}
                    </span>
                  </div>

                  {taxBreakdown['T10'] && (
                    <div className="totals-row text-xs text-muted">
                      <span>Standard Tax (10% on ¥{taxBreakdown['T10'].subtotal.toLocaleString()}):</span>
                      <span>¥{taxBreakdown['T10'].tax.toLocaleString()}</span>
                    </div>
                  )}

                  {taxBreakdown['T08'] && (
                    <div className="totals-row text-xs text-muted">
                      <span>Reduced Tax (8% on ¥{taxBreakdown['T08'].subtotal.toLocaleString()}):</span>
                      <span>¥{taxBreakdown['T08'].tax.toLocaleString()}</span>
                    </div>
                  )}

                  <div className="totals-row">
                    <span className="totals-label">Total Tax (消費税):</span>
                    <span className="totals-value">
                      ¥{taxAmount.toLocaleString()}
                    </span>
                  </div>

                  <div className="totals-row grand-total">
                    <span className="totals-label font-bold">Total Amount (御請求金額):</span>
                    <span className="totals-value font-bold text-primary">
                      ¥{totalAmount.toLocaleString()} JPY
                    </span>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="modal-footer mt-5">
                  <button
                    className="btn btn-secondary"
                    onClick={handleReExtract}
                    disabled={isReExtracting || isSubmitting}
                  >
                    <RefreshCw
                      size={14}
                      className={isReExtracting ? 'spin' : ''}
                    />
                    <span>Re-extract with AI</span>
                  </button>

                  <div className="footer-right-actions">
                    <button
                      className="btn btn-ghost"
                      onClick={onClose}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>

                    <button
                      className="btn btn-primary btn-lg"
                      onClick={handleRegister}
                      disabled={isSubmitting || !partnerCode || !invoiceNumber}
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw size={16} className="spin" />
                          <span>Registering with Accounting...</span>
                        </>
                      ) : (
                        <>
                          <Send size={16} />
                          <span>Register to Accounting System</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
