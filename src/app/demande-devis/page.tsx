'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function DemandeDevis() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [dossierNum, setDossierNum] = useState('');
  const [rectoFile, setRectoFile] = useState<File | null>(null);
  const [versoFile, setVersoFile] = useState<File | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulation du traitement (upload, création BDD...)
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccess(true);
      // Génération d'un numéro de dossier factice premium
      setDossierNum('DOS-' + Math.floor(1000 + Math.random() * 9000) + '-SN');
    }, 2000);
  };

  if (success) {
    return (
      <main style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="card animate-fade-in" style={{ padding: '4rem', textAlign: 'center', maxWidth: '600px', width: '100%', borderRadius: 'var(--radius-2xl)', backgroundColor: '#fff' }}>
          <div style={{ width: '80px', height: '80px', backgroundColor: 'var(--color-success)', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem auto' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--color-text-main)' }}>Demande Envoyée !</h1>
          <p style={{ fontSize: '1.125rem', color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
            Votre demande a été traitée avec succès. Nos agents vont vous contacter très rapidement sur WhatsApp et par Email avec une offre personnalisée.
          </p>
          <div style={{ backgroundColor: 'var(--color-gray-light)', padding: '2rem', borderRadius: 'var(--radius-lg)', marginBottom: '2rem', border: '1px solid rgba(0,0,0,0.05)' }}>
            <p style={{ fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Votre Numéro de Dossier</p>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '2px', margin: 0 }}>{dossierNum}</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '1rem' }}>Conservez ce numéro pour suivre l'état de votre demande. Vous pourrez également faire le suivi avec votre numéro de téléphone.</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/" className="btn btn-secondary" style={{ padding: '1rem 2rem' }}>Retour à l'accueil</Link>
            <Link href="/suivi" className="btn btn-primary" style={{ padding: '1rem 2rem' }}>Suivre mon dossier</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '80vh', padding: '4rem 2rem' }}>
      <div className="container" style={{ maxWidth: '800px' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: '1rem' }}>Demande de Devis</h1>
          <p style={{ fontSize: '1.25rem', color: 'var(--color-text-muted)', maxWidth: '600px', margin: '0 auto' }}>
            Obtenez une offre sur-mesure en quelques minutes, sans avoir besoin de créer de compte.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card animate-fade-in" style={{ padding: '3rem', borderRadius: 'var(--radius-2xl)', backgroundColor: '#fff' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Numéro WhatsApp</label>
              <input 
                type="tel" 
                required
                placeholder="Ex: +221 77 123 45 67" 
                style={{ width: '100%', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray)', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s', backgroundColor: 'var(--color-gray-light)' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Adresse Email</label>
              <input 
                type="email" 
                required
                placeholder="Ex: contact@votremail.com" 
                style={{ width: '100%', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray)', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s', backgroundColor: 'var(--color-gray-light)' }} 
              />
            </div>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Type de Véhicule</label>
            <select 
              required
              style={{ width: '100%', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray)', fontSize: '1rem', outline: 'none', backgroundColor: 'var(--color-gray-light)', cursor: 'pointer' }} 
            >
              <option value="">Sélectionnez un type</option>
              <option value="particulier">Véhicule Particulier</option>
              <option value="utilitaire">Véhicule Utilitaire</option>
              <option value="poids-lourd">Poids Lourd</option>
              <option value="deux-roues">Deux Roues</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
            <div>
              <span style={{ display: 'block', fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Carte Grise (Recto)</span>
              <label style={{ display: 'block', border: '2px dashed var(--color-gray)', borderRadius: 'var(--radius-lg)', padding: '2.5rem 1rem', textAlign: 'center', cursor: 'pointer', backgroundColor: rectoFile ? 'rgba(59, 130, 246, 0.05)' : 'var(--color-gray-light)', borderColor: rectoFile ? 'var(--color-primary)' : 'var(--color-gray)', transition: 'all 0.2s' }}>
                <input 
                  type="file" 
                  accept=".jpg,.jpeg,.png,.pdf" 
                  style={{ display: 'none' }} 
                  onChange={(e) => setRectoFile(e.target.files?.[0] || null)}
                />
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: 0 }}>
                  {rectoFile ? (
                    <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{rectoFile.name}</span>
                  ) : (
                    <>Cliquez pour uploader<br/><span style={{ fontSize: '0.75rem' }}>(JPG, PNG, PDF)</span></>
                  )}
                </p>
              </label>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Carte Grise (Verso)</span>
              <label style={{ display: 'block', border: '2px dashed var(--color-gray)', borderRadius: 'var(--radius-lg)', padding: '2.5rem 1rem', textAlign: 'center', cursor: 'pointer', backgroundColor: versoFile ? 'rgba(59, 130, 246, 0.05)' : 'var(--color-gray-light)', borderColor: versoFile ? 'var(--color-primary)' : 'var(--color-gray)', transition: 'all 0.2s' }}>
                <input 
                  type="file" 
                  accept=".jpg,.jpeg,.png,.pdf" 
                  style={{ display: 'none' }} 
                  onChange={(e) => setVersoFile(e.target.files?.[0] || null)}
                />
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: 0 }}>
                  {versoFile ? (
                    <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{versoFile.name}</span>
                  ) : (
                    <>Cliquez pour uploader<br/><span style={{ fontSize: '0.75rem' }}>(JPG, PNG, PDF)</span></>
                  )}
                </p>
              </label>
            </div>
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
                Traitement en cours...
              </>
            ) : (
              <>
                Envoyer la demande
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
