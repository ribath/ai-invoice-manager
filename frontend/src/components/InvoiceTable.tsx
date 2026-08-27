'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  ExternalLink,
  Trash2,
  FileCheck,
  Clock,
  AlertTriangle,
  RefreshCw,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { InvoiceRecord } from '../lib/api';

interface InvoiceTableProps {
  invoices: InvoiceRecord[];
  onSelectInvoice: (invoiceId: string) => void;
  onDeleteInvoice: (invoiceId: string) => void;
  onReExtract: (invoiceId: string) => void;
  isLoading: boolean;
}

export const InvoiceTable: React.FC<InvoiceTableProps> = ({
  invoices,
  onSelectInvoice,
  onDeleteInvoice,
  onReExtract,
  isLoading,
}) => {
  const [filterTab, setFilterTab] = useState<
    'all' | 'extracted' | 'registered' | 'issues'
  >('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [reExtractingId, setReExtractingId] = useState<string | null>(null);

  const handleReExtractClick = async (id: string) => {
    setReExtractingId(id);
    try {
      await onReExtract(id);
    } finally {
      setReExtractingId(null);
    }
  };

  const safeInvoices = Array.isArray(invoices) ? invoices : [];

  // Match invoice numbers across all items to detect duplicates
  const duplicateInvoiceNumbers = useMemo(() => {
    const counts: Record<string, number> = {};
    safeInvoices.forEach((inv) => {
      const invNo = (
        inv.invoiceNumber ||
        inv.extractedData?.invoice_number ||
        ''
      )
        .trim()
        .toLowerCase();
      if (invNo) {
        counts[invNo] = (counts[invNo] || 0) + 1;
      }
    });
    const dupes = new Set<string>();
    Object.entries(counts).forEach(([no, count]) => {
      if (count > 1) {
        dupes.add(no);
      }
    });
    return dupes;
  }, [safeInvoices]);

  const filteredInvoices = safeInvoices.filter((inv) => {
    const invNo = (
      inv.invoiceNumber ||
      inv.extractedData?.invoice_number ||
      ''
    )
      .trim()
      .toLowerCase();
    const isDuplicate = invNo !== '' && duplicateInvoiceNumbers.has(invNo);

    // Tab filtering
    if (filterTab === 'extracted' && inv.status !== 'EXTRACTED') return false;
    if (filterTab === 'registered' && inv.status !== 'REGISTERED') return false;
    if (
      filterTab === 'issues' &&
      inv.status !== 'EXTRACTION_FAILED' &&
      inv.status !== 'REGISTRATION_FAILED' &&
      !isDuplicate
    )
      return false;

    // Search query filtering
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      const fileName = inv.fileName?.toLowerCase() || '';
      const supplierName =
        inv.extractedData?.supplier_name?.toLowerCase() || '';
      const partnerCode = inv.partnerCode?.toLowerCase() || '';
      const invoiceNumber =
        inv.invoiceNumber?.toLowerCase() ||
        inv.extractedData?.invoice_number?.toLowerCase() ||
        '';
      const accountingId = inv.accountingId?.toLowerCase() || '';

      return (
        fileName.includes(q) ||
        supplierName.includes(q) ||
        partnerCode.includes(q) ||
        invoiceNumber.includes(q) ||
        accountingId.includes(q)
      );
    }

    return true;
  });

  const getStatusBadge = (
    status: InvoiceRecord['status'],
    isDuplicate: boolean,
  ) => {
    if (isDuplicate && status !== 'REGISTERED') {
      return (
        <span
          className="badge badge-danger"
          title="Duplicate invoice number detected across invoices"
        >
          <AlertTriangle size={12} />
          Duplicate Invoice
        </span>
      );
    }
    switch (status) {
      case 'EXTRACTED':
        return (
          <span className="badge badge-warning">
            <Clock size={12} />
            Ready for Review
          </span>
        );
      case 'REGISTERED':
        return (
          <span className="badge badge-success">
            <CheckCircle2 size={12} />
            Registered
          </span>
        );
      case 'PROCESSING':
      case 'UPLOADED':
        return (
          <span className="badge badge-info">
            <RefreshCw size={12} className="spin" />
            Processing...
          </span>
        );
      case 'EXTRACTION_FAILED':
        return (
          <span className="badge badge-danger">
            <AlertTriangle size={12} />
            Extraction Error
          </span>
        );
      case 'REGISTRATION_FAILED':
        return (
          <span className="badge badge-danger">
            <AlertTriangle size={12} />
            Registration Failed
          </span>
        );
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  return (
    <div className="card table-card">
      <div className="table-toolbar">
        <div className="filter-tabs">
          <button
            className={`tab-btn ${filterTab === 'all' ? 'active' : ''}`}
            onClick={() => setFilterTab('all')}
          >
            All Invoices ({safeInvoices.length})
          </button>
          <button
            className={`tab-btn ${filterTab === 'extracted' ? 'active' : ''}`}
            onClick={() => setFilterTab('extracted')}
          >
            Ready for Review (
            {safeInvoices.filter((i) => i.status === 'EXTRACTED').length})
          </button>
          <button
            className={`tab-btn ${filterTab === 'registered' ? 'active' : ''}`}
            onClick={() => setFilterTab('registered')}
          >
            Registered (
            {safeInvoices.filter((i) => i.status === 'REGISTERED').length})
          </button>
          <button
            className={`tab-btn ${filterTab === 'issues' ? 'active' : ''}`}
            onClick={() => setFilterTab('issues')}
          >
            Issues (
            {
              safeInvoices.filter((i) => {
                const invNo = (
                  i.invoiceNumber ||
                  i.extractedData?.invoice_number ||
                  ''
                )
                  .trim()
                  .toLowerCase();
                const isDupe =
                  invNo !== '' &&
                  duplicateInvoiceNumbers.has(invNo) &&
                  i.status !== 'REGISTERED';
                return (
                  i.status === 'EXTRACTION_FAILED' ||
                  i.status === 'REGISTRATION_FAILED' ||
                  isDupe
                );
              }).length
            }
            )
          </button>
        </div>

        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by file, supplier, #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="table-responsive">
        <table className="custom-table">
          <thead>
            <tr>
              <th>File Name</th>
              <th>Supplier (AI Extracted)</th>
              <th>Invoice #</th>
              <th>Issue Date</th>
              <th>Total (JPY)</th>
              <th>Status</th>
              <th>Accounting ID</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-muted">
                  <RefreshCw size={24} className="spin mb-2" />
                  <p>Loading invoice records...</p>
                </td>
              </tr>
            ) : filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-muted">
                  <p>No invoices found matching the current filter.</p>
                </td>
              </tr>
            ) : (
              filteredInvoices.map((inv) => {
                const supplierName =
                  inv.extractedData?.supplier_name ||
                  inv.partnerCode ||
                  '—';
                const invoiceNumber =
                  inv.invoiceNumber ||
                  inv.extractedData?.invoice_number ||
                  '—';
                const issueDate =
                  inv.issueDate || inv.extractedData?.issue_date || '—';
                const totalAmount =
                  inv.totalAmount ?? inv.extractedData?.total_amount;

                const cleanInvNo = (
                  inv.invoiceNumber ||
                  inv.extractedData?.invoice_number ||
                  ''
                )
                  .trim()
                  .toLowerCase();
                const isDuplicate =
                  cleanInvNo !== '' && duplicateInvoiceNumbers.has(cleanInvNo);

                return (
                  <tr
                    key={inv.id}
                    className={`table-row ${
                      inv.status === 'EXTRACTED' && !isDuplicate
                        ? 'row-highlight'
                        : isDuplicate && inv.status !== 'REGISTERED'
                        ? 'row-warning'
                        : ''
                    }`}
                  >
                    <td>
                      <div className="file-cell">
                        <span className="file-name-main" title={inv.fileName}>
                          {inv.fileName}
                        </span>
                        <span className="file-size-sub">
                          {(inv.fileSize / 1024).toFixed(0)} KB •{' '}
                          {inv.mimeType.includes('pdf') ? 'PDF' : 'JPG'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="supplier-cell">
                        <span className="supplier-name">{supplierName}</span>
                        {inv.extractedData?.tax_registration_no && (
                          <span className="tax-no-badge">
                            {inv.extractedData.tax_registration_no}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <code className="invoice-no-cell">{invoiceNumber}</code>
                    </td>
                    <td>
                      <span className="date-cell">{issueDate}</span>
                    </td>
                    <td>
                      <span className="amount-cell">
                        {totalAmount != null
                          ? `¥${totalAmount.toLocaleString()}`
                          : '—'}
                      </span>
                    </td>
                    <td>{getStatusBadge(inv.status, isDuplicate)}</td>
                    <td>
                      {inv.accountingId ? (
                        <span className="accounting-id-tag">
                          {inv.accountingId}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="action-buttons">
                        {inv.status === 'EXTRACTED' && !isDuplicate ? (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => onSelectInvoice(inv.id)}
                          >
                            <FileCheck size={14} />
                            <span>Review & Register</span>
                          </button>
                        ) : inv.status === 'EXTRACTION_FAILED' ||
                          (isDuplicate && inv.status !== 'REGISTERED') ||
                          inv.status === 'REGISTRATION_FAILED' ? (
                          <>
                            <button
                              className="btn-icon-sm"
                              onClick={() => handleReExtractClick(inv.id)}
                              disabled={reExtractingId === inv.id}
                              title={
                                reExtractingId === inv.id
                                  ? 'Extracting with AI...'
                                  : 'Retry AI Extraction'
                              }
                            >
                              <RefreshCw
                                size={14}
                                className={
                                  reExtractingId === inv.id ? 'spin' : ''
                                }
                              />
                            </button>
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => onSelectInvoice(inv.id)}
                              title={
                                isDuplicate
                                  ? 'Review & Resolve Duplicate'
                                  : 'Manually Review & Edit'
                              }
                            >
                              <FileCheck size={14} />
                              <span>
                                {isDuplicate ? 'Review & Fix' : 'Manual Review'}
                              </span>
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => onSelectInvoice(inv.id)}
                            title="View Details"
                          >
                            <Eye size={14} />
                            <span>Details</span>
                          </button>
                        )}

                        <button
                          className="btn-icon-sm btn-danger-hover"
                          onClick={() => onDeleteInvoice(inv.id)}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
