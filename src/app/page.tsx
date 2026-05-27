'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div>
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
        <div className="logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="var(--color-primary)"/>
            <path d="M2 17L12 22L22 17" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Business Action
        </div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/espace-client" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
            Espace Client
          </Link>
          <Link href="/admin" className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
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
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            color: 'var(--color-primary)',
            transition: 'all 0.3s ease'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </nav>
      </header>
        </div>
      </div>

      <main>
        {/* Hero Section */}
        <section className="animate-fade-in" style={{ position: 'relative', overflow: 'hidden', padding: '4rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '60vh', marginBottom: '4rem' }}>
          <Image 
            src="/hero-car.png" 
            alt="Chauffeur souriant dans une voiture sur la route" 
            fill
            style={{ objectFit: 'cover', zIndex: -2 }} 
            priority
          />
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.65)', zIndex: -1 }}></div>

          <span style={{ 
            background: 'rgba(255, 255, 255, 0.15)', 
            backdropFilter: 'blur(10px)',
            color: '#fff', 
            padding: '0.5rem 1rem', 
            borderRadius: '2rem', 
            fontWeight: 600, 
            fontSize: '0.875rem',
            marginBottom: '1.5rem',
            display: 'inline-block',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            Rapide, Sécurisé, Transparent
          </span>
          
          <h1 style={{ fontSize: '3.5rem', fontWeight: 800, color: '#ffffff', marginBottom: '1.5rem', maxWidth: '800px', lineHeight: 1.1, textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
            Obtenez votre <span style={{ color: 'var(--color-primary-light)' }}>devis assurance automobile</span> rapidement
          </h1>
          
          <p style={{ fontSize: '1.25rem', color: 'rgba(255, 255, 255, 0.9)', marginBottom: '2.5rem', maxWidth: '600px', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
            Envoyez simplement votre carte grise et recevez votre devis personnalisé. Gérez également vos dettes en toute transparence.
          </p>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/demande-devis" className="btn btn-primary" style={{ border: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.3)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
              Demander un devis
            </Link>
            <Link href="/suivi" className="btn btn-secondary" style={{ background: 'rgba(255, 255, 255, 0.15)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.3)', backdropFilter: 'blur(10px)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              Suivre mon dossier
            </Link>
          </div>
        </section>

        <div className="container">
          {/* Feature Cards Section */}
          <section style={{ padding: '2rem 0 6rem 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem', animationDelay: '0.2s' }} className="animate-fade-in">
          
          <div className="card">
            <div style={{ background: 'var(--color-primary-light)', width: '60px', height: '60px', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--color-primary)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Gestion des dettes</h3>
            <p style={{ color: 'var(--color-text-muted)' }}>Suivez vos encours, remboursements et historiques en toute clarté avec un suivi transparent.</p>
          </div>

          <div className="card">
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', width: '60px', height: '60px', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--color-success)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Devis automobile</h3>
            <p style={{ color: 'var(--color-text-muted)' }}>Obtenez rapidement une offre pour votre véhicule. Tout est numérisé et envoyé par WhatsApp.</p>
          </div>

          <div className="card">
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', width: '60px', height: '60px', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--color-warning)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Alertes d'échéance</h3>
            <p style={{ color: 'var(--color-text-muted)' }}>Ne ratez plus jamais vos renouvellements. Recevez des alertes 3 jours avant la fin.</p>
          </div>

          <div className="card">
            <div style={{ background: 'var(--color-primary-light)', width: '60px', height: '60px', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--color-primary)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Historique complet</h3>
            <p style={{ color: 'var(--color-text-muted)' }}>Chaque action est enregistrée. Consultez vos anciennes transactions à tout moment.</p>
          </div>

        </section>
        </div>
      </main>
    </div>
  );
}
