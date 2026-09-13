'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { MonitoringData } from '@/lib/monitoring';

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return '-';
  if (bytes === 0) return '0 o';
  const k = 1024;
  const sizes = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatBps(bps: number | null): string {
  if (bps === null || bps === undefined || isNaN(bps)) return '-';
  if (bps < 1024) return `${bps.toFixed(0)} o/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} Ko/s`;
  return `${(bps / (1024 * 1024)).toFixed(2)} Mo/s`;
}

export default function AdminMonitoringClient() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/monitoring', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Monitoring indisponible');
      }
      const json: MonitoringData = await res.json();
      setData(json);
      if (json.error) {
        setErrorMsg(json.error);
      }
      setLastRefreshed(new Date().toLocaleTimeString('fr-FR'));
    } catch {
      setErrorMsg('Monitoring indisponible');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '0.75rem',
    border: '1px solid #E2E8F0',
    padding: '1.25rem',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
  };

  const thStyle: React.CSSProperties = {
    padding: '0.75rem 1rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#64748B',
    borderBottom: '1px solid #E2E8F0',
    backgroundColor: '#F8FAFC',
  };

  const tdStyle: React.CSSProperties = {
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    color: '#1E293B',
    borderBottom: '1px solid #F1F5F9',
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC', paddingBottom: '3rem' }}>
      {/* Top Header */}
      <header
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          padding: '1rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          position: 'sticky',
          top: 0,
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link
            href="/admin"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#64748B',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
              padding: '0.375rem 0.75rem',
              borderRadius: '0.375rem',
              backgroundColor: '#F1F5F9',
            }}
          >
            ← Retour Admin
          </Link>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
            Monitoring Système
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {lastRefreshed && (
            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
              Dernière mise à jour : {lastRefreshed}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#0057D9',
              color: '#FFFFFF',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                animation: isLoading ? 'spin 1s linear infinite' : 'none',
              }}
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            {isLoading ? 'Actualisation...' : 'Actualiser'}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div style={{ maxWidth: '1280px', margin: '2rem auto', padding: '0 1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Error Alert */}
        {errorMsg && (
          <div
            style={{
              padding: '1rem 1.5rem',
              borderRadius: '0.5rem',
              backgroundColor: '#FEE2E2',
              border: '1px solid #FCA5A5',
              color: '#991B1B',
              fontSize: '0.875rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {errorMsg}
          </div>
        )}

        {/* 1. SECTION SERVEUR */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
              Serveur
            </h2>
            <span
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: data?.serverUp ? '#DCFCE7' : '#FEE2E2',
                color: data?.serverUp ? '#166534' : '#991B1B',
              }}
            >
              {data?.serverUp ? '● SERVEUR UP' : '● SERVEUR DOWN'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            {/* CPU */}
            <div style={cardStyle}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>CPU</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', marginTop: '0.25rem' }}>
                {data?.cpuPercent !== null && data?.cpuPercent !== undefined ? `${data.cpuPercent}%` : '-'}
              </div>
            </div>

            {/* RAM */}
            <div style={cardStyle}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>RAM</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', marginTop: '0.25rem' }}>
                {data?.ramPercent !== null && data?.ramPercent !== undefined ? `${data.ramPercent}%` : '-'}
              </div>
            </div>

            {/* Swap */}
            <div style={cardStyle}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Swap</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', marginTop: '0.25rem' }}>
                {data?.swapPercent !== null && data?.swapPercent !== undefined ? `${data.swapPercent}%` : '-'}
              </div>
            </div>

            {/* Disque */}
            <div style={cardStyle}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Disque racine</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', marginTop: '0.25rem' }}>
                {data?.diskPercent !== null && data?.diskPercent !== undefined ? `${data.diskPercent}%` : '-'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>
                {formatBytes(data?.diskFreeBytes ?? null)} libre
              </div>
            </div>

            {/* Load average */}
            <div style={cardStyle}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Load (1 min)</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', marginTop: '0.25rem' }}>
                {data?.load1 !== null && data?.load1 !== undefined ? data.load1 : '-'}
              </div>
            </div>

            {/* Réseau */}
            <div style={cardStyle}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Trafic Réseau</div>
              <div style={{ fontSize: '0.875rem', color: '#0F172A', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div>↓ In : <strong>{formatBps(data?.networkRxBps ?? null)}</strong></div>
                <div>↑ Out : <strong>{formatBps(data?.networkTxBps ?? null)}</strong></div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. SECTION SERVICES / TARGETS */}
        <section>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0F172A', marginBottom: '1rem' }}>
            Services de Supervision
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {/* Prometheus */}
            <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, color: '#0F172A' }}>Prometheus</div>
                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Collecteur de métriques</div>
              </div>
              <span
                style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: data?.targets?.prometheus === 'UP' ? '#DCFCE7' : '#FEE2E2',
                  color: data?.targets?.prometheus === 'UP' ? '#166534' : '#991B1B',
                }}
              >
                {data?.targets?.prometheus || 'UNKNOWN'}
              </span>
            </div>

            {/* Node Exporter */}
            <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, color: '#0F172A' }}>Node Exporter</div>
                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Métriques hôte Linux</div>
              </div>
              <span
                style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: data?.targets?.node_exporter === 'UP' ? '#DCFCE7' : '#FEE2E2',
                  color: data?.targets?.node_exporter === 'UP' ? '#166534' : '#991B1B',
                }}
              >
                {data?.targets?.node_exporter || 'UNKNOWN'}
              </span>
            </div>

            {/* cAdvisor */}
            <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, color: '#0F172A' }}>cAdvisor</div>
                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Métriques conteneurs</div>
              </div>
              <span
                style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: data?.targets?.cadvisor === 'UP' ? '#DCFCE7' : '#FEE2E2',
                  color: data?.targets?.cadvisor === 'UP' ? '#166534' : '#991B1B',
                }}
              >
                {data?.targets?.cadvisor || 'UNKNOWN'}
              </span>
            </div>
          </div>
        </section>

        {/* 3. SECTION CONTENEURS DOCKER */}
        <section>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0F172A', marginBottom: '1rem' }}>
            Conteneurs Docker ({data?.containers?.length || 0})
          </h2>

          <div style={{ ...cardStyle, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Image</th>
                  <th style={thStyle}>CPU</th>
                  <th style={thStyle}>RAM (Working Set)</th>
                  <th style={thStyle}>État</th>
                </tr>
              </thead>
              <tbody>
                {(!data?.containers || data.containers.length === 0) ? (
                  <tr>
                    <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: '#94A3B8', padding: '2rem' }}>
                      Aucun conteneur détecté ou monitoring indisponible
                    </td>
                  </tr>
                ) : (
                  data.containers.map((c) => (
                    <tr key={c.id}>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 600, color: '#0057D9' }}>
                        {c.id}
                      </td>
                      <td style={tdStyle}>
                        {c.image}
                      </td>
                      <td style={tdStyle}>
                        {c.cpuPercent}%
                      </td>
                      <td style={tdStyle}>
                        {formatBytes(c.memoryBytes)}
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor: c.status === 'UP' ? '#DCFCE7' : '#FEE2E2',
                            color: c.status === 'UP' ? '#166534' : '#991B1B',
                          }}
                        >
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}
