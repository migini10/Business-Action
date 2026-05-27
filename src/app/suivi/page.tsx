'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function Suivi() {
  const [method, setMethod] = useState<'telephone' | 'dossier'>('telephone');
  const [isSearching, setIsSearching] = useState(false);
  const [hasResult, setHasResult] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);
      setHasResult(true);
    }, 1500);
  };

  return (
    <main style={{ minHeight: '80vh', padding: '4rem 2rem' }}>
      <div className="container" style={{ maxWidth: '800px' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: '1rem' }}>Suivi de Dossier</h1>
          <p style={{ fontSize: '1.25rem', color: 'var(--color-text-muted)', maxWidth: '600px', margin: '0 auto' }}>
            Consultez l'avancement de votre demande de devis en temps réel.
          </p>
        </div>

        {!hasResult ? (
          <form onSubmit={handleSearch} className="card animate-fade-in" style={{ padding: '3rem', borderRadius: 'var(--radius-2xl)', backgroundColor: '#fff', maxWidth: '600px', margin: '0 auto' }}>
            
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', backgroundColor: 'var(--color-gray-light)', padding: '0.5rem', borderRadius: 'var(--radius-lg)' }}>
              <button 
                type="button"
                onClick={() => setMethod('telephone')}
                style={{ flex: 1, padding: '0.75rem', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', backgroundColor: method === 'telephone' ? '#fff' : 'transparent', color: method === 'telephone' ? 'var(--color-primary)' : 'var(--color-text-muted)', boxShadow: method === 'telephone' ? '0 2px 10px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}
              >
                Par Téléphone
              </button>
              <button 
                type="button"
                onClick={() => setMethod('dossier')}
                style={{ flex: 1, padding: '0.75rem', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', backgroundColor: method === 'dossier' ? '#fff' : 'transparent', color: method === 'dossier' ? 'var(--color-primary)' : 'var(--color-text-muted)', boxShadow: method === 'dossier' ? '0 2px 10px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}
              >
                Par N° de Dossier
              </button>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              {method === 'telephone' ? (
                <>
                  <label style={{ display: 'block', fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Votre numéro WhatsApp</label>
                  <input 
                    type="tel" 
                    required
                    placeholder="Ex: +221 77 123 45 67" 
                    style={{ width: '100%', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray)', fontSize: '1.125rem', outline: 'none', backgroundColor: '#fff' }} 
                  />
                </>
              ) : (
                <>
                  <label style={{ display: 'block', fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Votre Numéro de Dossier</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: DOS-1234-SN" 
                    style={{ width: '100%', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray)', fontSize: '1.125rem', outline: 'none', backgroundColor: '#fff', textTransform: 'uppercase' }} 
                  />
                </>
              )}
            </div>

            <button 
              type="submit" 
              disabled={isSearching}
              className="btn btn-primary" 
              style={{ width: '100%', padding: '1.25rem', fontSize: '1.125rem', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', opacity: isSearching ? 0.7 : 1, cursor: isSearching ? 'not-allowed' : 'pointer' }}
            >
              {isSearching ? (
                <>
                  <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
                  Recherche...
                </>
              ) : (
                <>
                  Rechercher mon dossier
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="card animate-fade-in" style={{ padding: '3rem', borderRadius: 'var(--radius-2xl)', backgroundColor: '#fff', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-gray-light)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>Dossier: DOS-8429-SN</h2>
                <p style={{ color: 'var(--color-text-muted)', margin: '0.5rem 0 0 0' }}>Véhicule Particulier • Lié au {method === 'telephone' ? '+221 77 *** ** **' : 'Dossier'}</p>
              </div>
              <span style={{ padding: '0.5rem 1rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)', borderRadius: '2rem', fontWeight: 600, fontSize: '0.875rem' }}>En traitement</span>
            </div>

            <div style={{ position: 'relative', paddingLeft: '2rem', margin: '3rem 0' }}>
              <div style={{ position: 'absolute', left: '7px', top: 0, bottom: 0, width: '2px', backgroundColor: 'var(--color-gray)' }}></div>
              
              <div style={{ position: 'relative', marginBottom: '2.5rem' }}>
                <div style={{ position: 'absolute', left: '-2rem', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'var(--color-success)', border: '4px solid #fff', outline: '2px solid var(--color-success)', zIndex: 1 }}></div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--color-text-main)' }}>Demande reçue</h3>
                <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '0.875rem' }}>Aujourd'hui à 10:30</p>
              </div>

              <div style={{ position: 'relative', marginBottom: '2.5rem' }}>
                <div style={{ position: 'absolute', left: '-2rem', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'var(--color-warning)', border: '4px solid #fff', outline: '2px solid var(--color-warning)', zIndex: 1 }}></div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--color-text-main)' }}>Analyse du dossier</h3>
                <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '0.875rem' }}>En cours de traitement par nos agents.</p>
              </div>

              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '-2rem', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'var(--color-gray)', border: '4px solid #fff', outline: '2px solid var(--color-gray)', zIndex: 1 }}></div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--color-text-muted)' }}>Offre envoyée via WhatsApp & Email</h3>
                <p style={{ color: 'var(--color-gray)', margin: 0, fontSize: '0.875rem' }}>À venir</p>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '3rem' }}>
              <button onClick={() => setHasResult(false)} className="btn btn-secondary" style={{ padding: '0.75rem 1.5rem' }}>Faire une autre recherche</button>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
