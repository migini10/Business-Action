'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function EspaceClient() {
  const [isLogin, setIsLogin] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsLoggedIn(true);
    }, 1500);
  };

  if (isLoggedIn) {
    return (
      <main className="animate-fade-in" style={{ minHeight: '80vh', padding: '4rem 2rem' }}>
        <div className="container" style={{ maxWidth: '1000px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>Tableau de Bord</h1>
            <button onClick={() => setIsLoggedIn(false)} className="btn btn-secondary" style={{ padding: '0.75rem 1.5rem', fontSize: '0.875rem' }}>Déconnexion</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
            <div className="card" style={{ padding: '2rem', borderLeft: '4px solid var(--color-primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', borderRadius: '0.5rem' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                </div>
                <h3 style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textTransform: 'uppercase', margin: 0 }}>Dossiers en cours</h3>
              </div>
              <p style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>1</p>
            </div>

            <div className="card" style={{ padding: '2rem', borderLeft: '4px solid var(--color-warning)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)', borderRadius: '0.5rem' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                </div>
                <h3 style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textTransform: 'uppercase', margin: 0 }}>Échéances à venir</h3>
              </div>
              <p style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>0</p>
            </div>

            <div className="card" style={{ padding: '2rem', borderLeft: '4px solid var(--color-success)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', borderRadius: '0.5rem' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                </div>
                <h3 style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textTransform: 'uppercase', margin: 0 }}>Paiements effectués</h3>
              </div>
              <p style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>3</p>
            </div>
          </div>

          <div className="card" style={{ padding: '2rem', borderRadius: 'var(--radius-xl)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '2rem', color: 'var(--color-text-main)' }}>Mes Dernières Demandes</h2>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', border: '1px solid var(--color-gray)', borderRadius: 'var(--radius-lg)', marginBottom: '1rem', backgroundColor: 'var(--color-gray-light)' }}>
              <div>
                <p style={{ fontWeight: 800, color: 'var(--color-text-main)', margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>DOS-8429-SN</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>Demande de devis • Véhicule Particulier</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ padding: '0.5rem 1rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)', borderRadius: '2rem', fontWeight: 600, fontSize: '0.875rem' }}>En traitement</span>
                <Link href="/suivi" style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none' }}>Voir &rarr;</Link>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', border: '1px solid var(--color-gray)', borderRadius: 'var(--radius-lg)' }}>
              <div>
                <p style={{ fontWeight: 800, color: 'var(--color-text-main)', margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>DOS-1204-SN</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>Demande de devis • Poids Lourd</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ padding: '0.5rem 1rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', borderRadius: '2rem', fontWeight: 600, fontSize: '0.875rem' }}>Terminé</span>
                <span style={{ color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none', cursor: 'pointer' }}>Voir &rarr;</span>
              </div>
            </div>

          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '80vh', display: 'flex', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '450px', padding: '2.5rem 1.5rem', borderRadius: 'var(--radius-xl)', backgroundColor: '#fff', margin: 'auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ width: '64px', height: '64px', backgroundColor: 'var(--color-primary-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', color: 'var(--color-primary)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text-main)', margin: '0 0 0.5rem 0' }}>Espace Client</h1>
          <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>
            {isLogin ? 'Connectez-vous à votre compte' : 'Créez votre compte client'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Nom Complet</label>
              <input 
                type="text" 
                required
                placeholder="Ex: Amadou Diallo" 
                style={{ width: '100%', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray)', fontSize: '1rem', outline: 'none', backgroundColor: 'var(--color-gray-light)', transition: 'border-color 0.2s' }} 
              />
            </div>
          )}

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Numéro de Téléphone (WhatsApp)</label>
            <input 
              type="tel" 
              required
              placeholder="Ex: +221 77 123 45 67" 
              style={{ width: '100%', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray)', fontSize: '1rem', outline: 'none', backgroundColor: 'var(--color-gray-light)', transition: 'border-color 0.2s' }} 
            />
          </div>

          <div style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-main)', margin: 0 }}>Mot de Passe</label>
              {isLogin && (
                <a href="#" style={{ fontSize: '0.75rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>Oublié ?</a>
              )}
            </div>
            <input 
              type="password" 
              required
              placeholder="••••••••" 
              style={{ width: '100%', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray)', fontSize: '1rem', outline: 'none', backgroundColor: 'var(--color-gray-light)', transition: 'border-color 0.2s' }} 
            />
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="btn btn-primary" 
            style={{ width: '100%', padding: '1.25rem', fontSize: '1.125rem', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
                Connexion...
              </>
            ) : (
              isLogin ? 'Se connecter' : 'Créer mon compte'
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: 0 }}>
            {isLogin ? "Vous n'avez pas de compte ?" : "Vous avez déjà un compte ?"}
            <br />
            <button 
              onClick={() => setIsLogin(!isLogin)}
              style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer', marginTop: '0.5rem', fontSize: '0.875rem', transition: 'color 0.2s' }}
            >
              {isLogin ? "Créer un compte maintenant" : "Se connecter"}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
