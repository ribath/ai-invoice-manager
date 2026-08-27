'use client';

import React from 'react';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Coins,
} from 'lucide-react';
import { InvoiceRecord } from '../lib/api';

interface StatsCardsProps {
  invoices: InvoiceRecord[];
}

export const StatsCards: React.FC<StatsCardsProps> = ({ invoices }) => {
  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  const totalInvoices = safeInvoices.length;
  const readyForReview = safeInvoices.filter(
    (i) => i.status === 'EXTRACTED',
  ).length;
  const processing = safeInvoices.filter(
    (i) => i.status === 'PROCESSING' || i.status === 'UPLOADED',
  ).length;
  const registered = safeInvoices.filter(
    (i) => i.status === 'REGISTERED',
  ).length;
  const failed = safeInvoices.filter(
    (i) =>
      i.status === 'EXTRACTION_FAILED' || i.status === 'REGISTRATION_FAILED',
  ).length;

  const totalRegisteredAmount = safeInvoices
    .filter((i) => i.status === 'REGISTERED' && i.totalAmount)
    .reduce((sum, i) => sum + (i.totalAmount || 0), 0);

  return (
    <div className="stats-grid">

      <div className="stat-card">
        <div className="stat-icon-wrap review">
          <Clock size={20} />
        </div>
        <div className="stat-content">
          <span className="stat-label">Ready for Review</span>
          <div className="stat-value">{readyForReview}</div>
          <span className="stat-subtext">
            {processing > 0 ? `${processing} extracting...` : 'AI Extracted'}
          </span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon-wrap registered">
          <CheckCircle2 size={20} />
        </div>
        <div className="stat-content">
          <span className="stat-label">Registered in Accounting</span>
          <div className="stat-value">{registered}</div>
          <span className="stat-subtext">ACC-0001+ verified</span>
        </div>
      </div>

      {failed > 0 && (
        <div className="stat-card stat-card-alert">
          <div className="stat-icon-wrap failed">
            <AlertTriangle size={20} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Requires Attention</span>
            <div className="stat-value">{failed}</div>
            <span className="stat-subtext">Extraction/Sync failed</span>
          </div>
        </div>
      )}
    </div>
  );
};
