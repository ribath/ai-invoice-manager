'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { InvoiceUploader } from '../components/InvoiceUploader';
import { InvoiceTable } from '../components/InvoiceTable';
import { InvoiceReviewModal } from '../components/InvoiceReviewModal';
import { api, InvoiceRecord } from '../lib/api';

interface ToastState {
  type: 'success' | 'error';
  title: string;
  message: string;
}

export default function Home() {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = (type: 'success' | 'error', title: string, message: string) => {
    setToast({ type, title, message });
    setTimeout(() => {
      setToast(null);
    }, 6000);
  };

  const fetchDashboardData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Fetch Invoices from backend DB
      const invoiceList = await api.getInvoices();
      setInvoices(invoiceList || []);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setIsLoadingInvoices(false);
      setIsRefreshing(false);
    }
  }, []);

  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchDashboardData();
    }
  }, [fetchDashboardData]);

  const handleDeleteInvoice = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice record?')) return;
    try {
      await api.deleteInvoice(id);
      await fetchDashboardData();
      showToast('success', 'Invoice Deleted', 'Invoice record has been removed.');
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleResetSystem = async () => {
    setIsRefreshing(true);
    try {
      await api.resetAll();
      await fetchDashboardData();
      showToast(
        'success',
        'System Reset Complete',
        'All invoices cleared from database and mock accounting system.',
      );
    } catch (err: any) {
      console.error('Reset failed:', err);
      showToast('error', 'Reset Failed', err.message || 'Could not reset system');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleReExtract = async (id: string) => {
    try {
      await api.reExtractInvoice(id);
      await fetchDashboardData();
    } catch (err: any) {
      alert(`Re-extraction failed: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar
        onRefresh={handleResetSystem}
        isRefreshing={isRefreshing}
      />

      <main className="app-container">
        {/* Ingestion & Sequential Extraction Dropzone */}
        <InvoiceUploader onUploadSuccess={fetchDashboardData} />

        {/* Invoices List Table */}
        <InvoiceTable
          invoices={invoices}
          onSelectInvoice={(id) => setSelectedInvoiceId(id)}
          onDeleteInvoice={handleDeleteInvoice}
          onReExtract={handleReExtract}
          isLoading={isLoadingInvoices}
        />
      </main>

      {/* Split-Screen Review Modal */}
      {selectedInvoiceId && (
        <InvoiceReviewModal
          invoiceId={selectedInvoiceId}
          onClose={() => setSelectedInvoiceId(null)}
          onSuccess={(accountingResult, invoiceNum) => {
            fetchDashboardData();
            showToast(
              'success',
              'Registration Successful!',
              `Invoice ${invoiceNum ? `#${invoiceNum}` : ''} registered with Accounting ID ${accountingResult?.accounting_id || ''}.`,
            );
          }}
          onError={() => {
            fetchDashboardData();
          }}
        />
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <CheckCircle2
              size={20}
              style={{ color: '#16a34a', flexShrink: 0, marginTop: 2 }}
            />
            <div style={{ flex: 1 }}>
              <div className="toast-title">{toast.title}</div>
              <div className="toast-body">{toast.message}</div>
            </div>
            <button className="toast-close" onClick={() => setToast(null)} title="Close">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
