'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function Topbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      {/* Sidebar Navigation */}
      <div className={`sidebar-overlay ${isMenuOpen ? 'open' : ''}`} onClick={() => setIsMenuOpen(false)}></div>
      <div className={`sidebar ${isMenuOpen ? 'open' : ''}`}>
        <button className="sidebar-close" onClick={() => setIsMenuOpen(false)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <Link href="/" className="sidebar-link" onClick={() => setIsMenuOpen(false)}>Accueil</Link>
        <Link href="/espace-client" className="sidebar-link" onClick={() => setIsMenuOpen(false)}>Espace Client</Link>
        <Link href="/demande-devis" className="sidebar-link" onClick={() => setIsMenuOpen(false)}>Demander un devis</Link>
        <Link href="/suivi" className="sidebar-link" onClick={() => setIsMenuOpen(false)}>Suivre sans compte</Link>
        <Link href="/admin" className="sidebar-link" onClick={() => setIsMenuOpen(false)}>Accès Admin</Link>
      </div>

      <div className="topbar">
        <div className="container">
          <header className="header animate-fade-in">
            <Link href="/" style={{ textDecoration: 'none' }}>
              <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--color-text-main)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="var(--color-primary)"/>
                  <path d="M2 17L12 22L22 17" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontWeight: 800 }}>Business Action</span>
              </div>
            </Link>
            <nav style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Link href="/espace-client" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                Espace Client
              </Link>
              <Link href="/admin" className="btn btn-secondary hide-mobile" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                Accès Admin
              </Link>
              <button 
                onClick={() => setIsMenuOpen(true)}
                style={{ 
                background: 'var(--color-primary-light)', 
                border: 'none', 
                borderRadius: '0.5rem', 
                width: '40px', 
                height: '40px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--color-primary)'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
              </button>
            </nav>
          </header>
        </div>
      </div>
    </>
  );
}
