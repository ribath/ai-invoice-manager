'use client';

import React from 'react';
import {
  FileSpreadsheet,
  Activity,
  RefreshCw,
  Sparkles,
  Server,
} from 'lucide-react';

interface NavbarProps {
  apiStatus: 'healthy' | 'error' | 'loading';
  registeredCount: number;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  apiStatus,
  registeredCount,
  onRefresh,
  isRefreshing,
}) => {
  return (
    <header className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <div className="brand-logo">
            <Sparkles className="logo-sparkle" size={20} />
            <FileSpreadsheet size={24} className="logo-icon" />
          </div>
          <div>
            <div className="brand-title-wrap">
              <h1 className="brand-title">InvoiceFlow AI</h1>
              <span className="brand-badge">Intelligent Intake</span>
            </div>
          </div>
        </div>

        <div className="navbar-actions">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="btn btn-secondary btn-icon"
            title="Refresh Invoices"
          >
            <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>
    </header>
  );
};
