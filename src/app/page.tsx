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
            Envoyez simplement votre carte grise et recevez votre devis personnalisé. Gérez également vos factures et paiements en toute transparence.
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

        {/* Social Proof / Trusted By */}
        <section style={{ padding: '3rem 0', borderTop: '1px solid var(--color-gray-light)', borderBottom: '1px solid var(--color-gray-light)', backgroundColor: '#ffffff', textAlign: 'center', marginBottom: '4rem' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1.5rem' }}>Ils nous font confiance</p>
          <div className="container" style={{ display: 'flex', justifyContent: 'center', gap: '3rem', flexWrap: 'wrap', opacity: 0.6, alignItems: 'center' }}>
            <h2 style={{ fontFamily: 'serif', fontStyle: 'italic', margin: 0 }}>Allianz</h2>
            <h2 style={{ fontFamily: 'sans-serif', fontWeight: 800, margin: 0 }}>AXA</h2>
            <h2 style={{ fontFamily: 'monospace', fontSize: '1.5rem', margin: 0 }}>WafaAssurance</h2>
            <h2 style={{ fontFamily: 'sans-serif', fontWeight: 300, letterSpacing: '2px', margin: 0 }}>SUNU</h2>
            <h2 style={{ fontFamily: 'serif', fontWeight: 700, margin: 0 }}>Sanlam</h2>
          </div>
        </section>

        <div className="container">
          {/* Feature Cards Section */}
          <section style={{ padding: '2rem 0 6rem 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem', animationDelay: '0.2s' }} className="animate-fade-in">
          
          <div className="card">
            <div style={{ background: 'var(--color-primary-light)', width: '60px', height: '60px', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--color-primary)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Suivi des paiements</h3>
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

        {/* How It Works Section */}
        <section style={{ padding: '6rem 0', backgroundColor: 'var(--color-white)' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: '1rem' }}>Comment ça marche ?</h2>
              <p style={{ fontSize: '1.25rem', color: 'var(--color-text-muted)', maxWidth: '600px', margin: '0 auto' }}>Un processus simple, transparent et 100% digitalisé pour votre confort.</p>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '3rem', position: 'relative' }}>
              <div style={{ textAlign: 'center', zIndex: 1 }}>
                <div style={{ width: '80px', height: '80px', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 800, margin: '0 auto 1.5rem auto' }}>1</div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Photographiez</h3>
                <p style={{ color: 'var(--color-text-muted)' }}>Prenez en photo votre carte grise (recto/verso) avec votre smartphone. Pas besoin de créer de compte.</p>
              </div>

              <div style={{ textAlign: 'center', zIndex: 1 }}>
                <div style={{ width: '80px', height: '80px', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 800, margin: '0 auto 1.5rem auto' }}>2</div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Recevez votre devis</h3>
                <p style={{ color: 'var(--color-text-muted)' }}>Nos agents traitent votre demande en un temps record et vous envoient une offre compétitive sur WhatsApp et Email.</p>
              </div>

              <div style={{ textAlign: 'center', zIndex: 1 }}>
                <div style={{ width: '80px', height: '80px', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 800, margin: '0 auto 1.5rem auto' }}>3</div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Gérez en ligne</h3>
                <p style={{ color: 'var(--color-text-muted)' }}>Suivez vos règlements, validez vos devis et recevez des alertes avant l'expiration de vos contrats.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section style={{ padding: '6rem 0', backgroundColor: 'var(--color-gray-light)' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: '1rem' }}>Ce que disent nos clients</h2>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
              <div className="card" style={{ padding: '2rem', backgroundColor: '#fff', borderRadius: 'var(--radius-xl)' }}>
                <div style={{ display: 'flex', color: '#F59E0B', marginBottom: '1rem', gap: '0.2rem' }}>
                  ★ ★ ★ ★ ★
                </div>
                <p style={{ fontStyle: 'italic', marginBottom: '1.5rem', color: 'var(--color-text-main)' }}>"Incroyable ! J'ai envoyé ma carte grise et en moins d'une heure j'avais mon devis d'assurance sur WhatsApp. Le suivi est parfait."</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>M</div>
                  <div>
                    <h4 style={{ margin: 0, fontWeight: 700 }}>Moussa N.</h4>
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Entrepreneur, Dakar</span>
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: '2rem', backgroundColor: '#fff', borderRadius: 'var(--radius-xl)' }}>
                <div style={{ display: 'flex', color: '#F59E0B', marginBottom: '1rem', gap: '0.2rem' }}>
                  ★ ★ ★ ★ ★
                </div>
                <p style={{ fontStyle: 'italic', marginBottom: '1.5rem', color: 'var(--color-text-main)' }}>"Le suivi des paiements est tellement transparent. Je sais exactement ce qu'il me reste à régler et j'ai l'historique complet."</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>A</div>
                  <div>
                    <h4 style={{ margin: 0, fontWeight: 700 }}>Aissatou S.</h4>
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Commerçante</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section style={{ padding: '6rem 0', backgroundColor: 'var(--color-primary)', color: '#fff', textAlign: 'center' }}>
          <div className="container">
            <h2 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '1.5rem' }}>Prêt à simplifier votre assurance ?</h2>
            <p style={{ fontSize: '1.25rem', opacity: 0.9, marginBottom: '2.5rem', maxWidth: '600px', margin: '0 auto 2.5rem auto' }}>Rejoignez des milliers d'utilisateurs qui gèrent déjà leurs devis et paiements avec notre plateforme de classe mondiale.</p>
            <Link href="/demande-devis" className="btn btn-secondary" style={{ padding: '1rem 2.5rem', fontSize: '1.125rem', color: 'var(--color-primary)', borderRadius: 'var(--radius-2xl)', display: 'inline-flex' }}>
              Commencer maintenant (Sans compte)
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ backgroundColor: '#0B0F19', color: '#fff', padding: '5rem 0 2rem 0' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '4rem', marginBottom: '4rem' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#fff"/>
                  <path d="M2 17L12 22L22 17" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Business Action
              </div>
              <p style={{ color: '#94A3B8', fontSize: '1rem', lineHeight: 1.6, maxWidth: '400px' }}>La plateforme SaaS de référence pour la gestion de devis d'assurance et de paiements. Rapide, sécurisée et totalement transparente.</p>
            </div>
            
            <div>
              <h4 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem', color: '#F8FAFC' }}>Produit</h4>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem', color: '#94A3B8' }}>
                <li><Link href="/demande-devis" style={{ transition: 'color 0.2s' }}>Demander un devis</Link></li>
                <li><Link href="/suivi" style={{ transition: 'color 0.2s' }}>Suivi de dossier</Link></li>
                <li><Link href="/espace-client" style={{ transition: 'color 0.2s' }}>Espace Client</Link></li>
                <li><Link href="/admin" style={{ transition: 'color 0.2s' }}>Espace Admin</Link></li>
              </ul>
            </div>

            <div>
              <h4 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem', color: '#F8FAFC' }}>Légal</h4>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem', color: '#94A3B8' }}>
                <li><Link href="#">Conditions générales</Link></li>
                <li><Link href="#">Politique de confidentialité</Link></li>
                <li><Link href="#">Mentions légales</Link></li>
              </ul>
            </div>

            <div>
              <h4 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem', color: '#F8FAFC' }}>Contact</h4>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem', color: '#94A3B8' }}>
                <li>contact@afrodev.com</li>
                <li>+221 77 123 45 67</li>
                <li>Dakar, Sénégal</li>
              </ul>
            </div>
          </div>
          
          <div style={{ borderTop: '1px solid #1E293B', paddingTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', color: '#64748B', fontSize: '0.875rem' }}>
            <p>&copy; {new Date().getFullYear()} AFRODEV SaaS. Tous droits réservés.</p>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <Link href="#" aria-label="Facebook"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg></Link>
              <Link href="#" aria-label="Twitter"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg></Link>
              <Link href="#" aria-label="LinkedIn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg></Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
