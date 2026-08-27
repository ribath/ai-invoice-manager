'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from '../components/Navbar';
import { InvoiceUploader } from '../components/InvoiceUploader';
import { InvoiceTable } from '../components/InvoiceTable';
import { InvoiceReviewModal } from '../components/InvoiceReviewModal';
import { api, InvoiceRecord } from '../lib/api';

export default function Home() {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

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
        onRefresh={fetchDashboardData}
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
          onSuccess={() => {
            fetchDashboardData();
          }}
        />
      )}
    </div>
  );
}
