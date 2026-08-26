'use client';

import React, { useState, useEffect } from 'react';

export default function Home() {
  const [health, setHealth] = useState<string>('Checking backend...');

  useEffect(() => {
    fetch('http://localhost:3001/health')
      .then((res) => res.json())
      .then((data) => setHealth(`Backend Status: ${data.status}`))
      .catch(() => setHealth('Backend offline / connecting...'));
  }, []);

  return (
    <main style={{ padding: '3rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          AI Invoice Intake Automation
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Sample Trading Co., Ltd. - Invoice Processing & Human-in-the-Loop Review
        </p>
      </header>

      <div style={{ padding: '1.5rem', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>System Status</h2>
        <p style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>{health}</p>
      </div>
    </main>
  );
}
