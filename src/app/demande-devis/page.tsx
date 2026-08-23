'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { createDossier, FormField, CreateDossierResult } from '@/app/actions/dossier';
import DocumentScanner from '@/components/DocumentScanner';

export default function DemandeDevis() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [dossierNum, setDossierNum] = useState('');
  const [rectoFile, setRectoFile] = useState<File | null>(null);
  const [versoFile, setVersoFile] = useState<File | null>(null);
  const [cmcFile, setCmcFile] = useState<File | null>(null);
  const [situation, setSituation] = useState('immatricule');

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FormField, string>>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const dataStr = localStorage.getItem('client_data');
      if (dataStr) {
        try {
          const clientData = JSON.parse(dataStr);
          const phoneInput = document.querySelector('input[name="phone"]') as HTMLInputElement;
          const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement;
          if (phoneInput && clientData.phone) phoneInput.value = clientData.phone;
          if (emailInput && clientData.email) emailInput.value = clientData.email;
        } catch (e) {
          console.error("Erreur de lecture des données client", e);
        }
      }
    }
  }, []);

  const clearFieldError = (field: FormField) => {
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFieldErrors({});
    setGlobalError(null);

    const formData = new FormData(e.currentTarget);
    formData.set('situationVehicule', situation);

    if (rectoFile) {
      formData.set(situation === 'non_immatricule' ? 'cmc' : 'recto', rectoFile);
    }
    if (versoFile && situation === 'immatricule') {
      formData.set('verso', versoFile);
    }
    if (situation === 'non_immatricule' && cmcFile) {
      formData.set('cmc', cmcFile);
    }

    try {
      const result = await createDossier(formData) as CreateDossierResult;
      setIsSubmitting(false);

      if (result.success && 'numeroDossier' in result) {
        setSuccess(true);
        setDossierNum(result.numeroDossier);
      } else if (!result.success && 'errors' in result) {
        setFieldErrors(result.errors);
        if (result.errors.global) {
          setGlobalError(result.errors.global);
        }
      } else {
        setGlobalError("Une erreur inconnue s'est produite.");
      }
    } catch (err: any) {
      setIsSubmitting(false);
      console.error(err);
      setGlobalError("Erreur de connexion : le fichier est peut-être trop lourd ou le serveur est injoignable.");
    }
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

          {globalError && (
            <div role="alert" aria-live="assertive" style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '2rem', border: '1px solid #f87171' }}>
              <strong>Erreur lors de l'envoi : </strong> {globalError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Numéro WhatsApp</label>
              <input
                type="tel"
                name="phone"
                required
                placeholder="Ex: +221 77 123 45 67"
                onChange={() => clearFieldError('phone')}
                style={{ width: '100%', padding: '1rem', borderRadius: 'var(--radius-lg)', border: fieldErrors.phone ? '2px solid #ef4444' : '1px solid var(--color-gray)', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s', backgroundColor: 'var(--color-gray-light)' }}
              />
              {fieldErrors.phone && <p role="alert" style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.5rem', fontWeight: 500 }}>{fieldErrors.phone}</p>}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Adresse Email (Optionnel)</label>
              <input
                type="email"
                name="email"
                placeholder="Ex: contact@votremail.com"
                onChange={() => clearFieldError('email')}
                style={{ width: '100%', padding: '1rem', borderRadius: 'var(--radius-lg)', border: fieldErrors.email ? '2px solid #ef4444' : '1px solid var(--color-gray)', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s', backgroundColor: 'var(--color-gray-light)' }}
              />
              {fieldErrors.email && <p role="alert" style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.5rem', fontWeight: 500 }}>{fieldErrors.email}</p>}
            </div>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Type de Véhicule</label>
            <select
              name="typeVehicule"
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

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Situation du véhicule</label>
            <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="radio" name="situationVehicule" value="immatricule" checked={situation === 'immatricule'} onChange={(e) => { setSituation(e.target.value); setRectoFile(null); setVersoFile(null); setFieldErrors({}); setGlobalError(null); }} />
                <span>Véhicule déjà immatriculé (Carte Grise)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="radio" name="situationVehicule" value="non_immatricule" checked={situation === 'non_immatricule'} onChange={(e) => { setSituation(e.target.value); setRectoFile(null); setVersoFile(null); setFieldErrors({}); setGlobalError(null); }} />
                <span>Véhicule pas encore immatriculé (CMC)</span>
              </label>
            </div>
          </div>

          {situation === 'non_immatricule' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
              <div style={{ minHeight: '200px' }}>
                <DocumentScanner
                  name="cmc"
                  label="Document CMC (Taille max: 4MB. Formats: JPG, PNG, PDF)"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onFileAccepted={(f) => { setCmcFile(f); clearFieldError('cmc'); }}
                  isPdfOk={true}
                  errorMsg={fieldErrors.cmc}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
              <div style={{ minHeight: '200px' }}>
                <DocumentScanner
                  name="recto"
                  label="Carte Grise (Recto)"
                  accept=".jpg,.jpeg,.png"
                  onFileAccepted={(f) => { setRectoFile(f); clearFieldError('recto'); }}
                  errorMsg={fieldErrors.recto}
                />
              </div>

              <div style={{ minHeight: '200px' }}>
                <DocumentScanner
                  name="verso"
                  label="Carte Grise (Verso)"
                  accept=".jpg,.jpeg,.png"
                  onFileAccepted={(f) => { setVersoFile(f); clearFieldError('verso'); }}
                  errorMsg={fieldErrors.verso}
                />
              </div>
            </div>
          )}

          <style>{`
            .btn-submit {
              overflow: hidden;
              transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
              background: var(--color-primary);
            }
            .btn-submit:hover:not(:disabled) .hover-plane {
              transform: translate(4px, -4px);
            }
            .btn-submit:hover:not(:disabled) {
              box-shadow: 0 10px 25px -5px rgba(22, 101, 52, 0.4);
              transform: translateY(-2px);
            }
          `}</style>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-submit"
            style={{
              width: '100%',
              padding: '1.25rem',
              fontSize: '1.125rem',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-xl)',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              fontWeight: 600,
            }}
          >
            {isSubmitting ? 'Envoi en cours...' : (
              <>
                Recevoir mon devis gratuit
                <svg className="hover-plane" style={{ transition: 'transform 0.3s ease' }} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </>
            )}
          </button>

          <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            Vos données sont chiffrées et sécurisées
          </p>
        </form>
      </div>
    </main>
  );
}
