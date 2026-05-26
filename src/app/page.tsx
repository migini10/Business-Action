import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
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
        <nav>
          <Link href="/admin" className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
            Accès Admin
          </Link>
        </nav>
      </header>

      <main>
        {/* Hero Section */}
        <section className="animate-fade-in" style={{ padding: '6rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <span style={{ 
            background: 'var(--color-primary-light)', 
            color: 'var(--color-primary-dark)', 
            padding: '0.5rem 1rem', 
            borderRadius: '2rem', 
            fontWeight: 600, 
            fontSize: '0.875rem',
            marginBottom: '1.5rem',
            display: 'inline-block'
          }}>
            Rapide, Sécurisé, Transparent
          </span>
          
          <h1 style={{ fontSize: '3.5rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: '1.5rem', maxWidth: '800px', lineHeight: 1.1 }}>
            Obtenez votre <span style={{ color: 'var(--color-primary)' }}>devis assurance automobile</span> rapidement
          </h1>
          
          <p style={{ fontSize: '1.25rem', color: 'var(--color-text-muted)', marginBottom: '3rem', maxWidth: '600px' }}>
            Envoyez simplement votre carte grise et recevez votre devis personnalisé. Gérez également vos dettes en toute transparence.
          </p>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '4rem' }}>
            <Link href="/demande-devis" className="btn btn-primary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
              Demander un devis
            </Link>
            <Link href="/suivi" className="btn btn-secondary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              Suivre mon dossier
            </Link>
          </div>

          <div style={{ width: '100%', maxWidth: '1000px', margin: '0 auto', borderRadius: '1.5rem', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <Image 
              src="/hero-car.png" 
              alt="Chauffeur souriant dans une voiture sur la route" 
              width={1024} 
              height={1024} 
              style={{ width: '100%', maxHeight: '500px', objectFit: 'cover', display: 'block' }} 
              priority
            />
          </div>
        </section>

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
      </main>
    </div>
  );
}
