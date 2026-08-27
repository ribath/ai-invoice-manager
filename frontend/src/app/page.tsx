'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '../components/Navbar';
import { StatsCards } from '../components/StatsCards';
import { InvoiceUploader } from '../components/InvoiceUploader';
import { InvoiceTable } from '../components/InvoiceTable';
import { InvoiceReviewModal } from '../components/InvoiceReviewModal';
import { api, InvoiceRecord } from '../lib/api';

export default function Home() {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [apiStatus, setApiStatus] = useState<'healthy' | 'error' | 'loading'>('loading');
  const [registeredCount, setRegisteredCount] = useState<number>(0);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // 1. Fetch Mock API Health
      try {
        const health = await api.getAccountingHealth();
        if (health && health.status === 'ok') {
          setApiStatus('healthy');
          setRegisteredCount(health.registered_invoices || 0);
        } else {
          setApiStatus('error');
        }
      } catch (e) {
        setApiStatus('error');
      }

      // 2. Fetch Invoices from backend DB
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
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
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
        apiStatus={apiStatus}
        registeredCount={registeredCount}
        onRefresh={fetchDashboardData}
        isRefreshing={isRefreshing}
      />

      <main className="app-container">
        {/* Metric Cards */}
        <StatsCards invoices={invoices} />

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
          onSuccess={() => {
            fetchDashboardData();
          }}
        />
      )}
    </div>
  );
}
