'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { createDossier } from '@/app/actions/dossier';
import DocumentScanner from '@/components/DocumentScanner';

export default function DemandeDevis() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [dossierNum, setDossierNum] = useState('');
  const [rectoFile, setRectoFile] = useState<File | null>(null);
  const [versoFile, setVersoFile] = useState<File | null>(null);
  const [cmcFile, setCmcFile] = useState<File | null>(null);
  const [situation, setSituation] = useState('immatricule');
  const [serverError, setServerError] = useState<string | null>(null);


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

  const compressImage = async (file: File): Promise<File> => {
    if (!file.type.startsWith('image/')) return file;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 1200;
          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
            } else {
              resolve(file);
            }
          }, 'image/jpeg', 0.8);
        };
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    formData.set('situationVehicule', situation);

    // Compression et recadrage déjà gérés par DocumentScanner pour recto/verso/cmc (JPEG)
    // Sauf si c'est un PDF, on l'envoie tel quel.
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
      const result = await createDossier(formData);
      setIsSubmitting(false);

      if (result.success && result.numeroDossier) {
        setSuccess(true);
        setDossierNum(result.numeroDossier);
        setServerError(null);
      } else {
        setServerError(result.error || "Une erreur inconnue s'est produite.");
      }
    } catch (err: any) {
      setIsSubmitting(false);
      console.error(err);
      alert("Erreur de connexion : le fichier est peut-être trop lourd ou le serveur est injoignable.");
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

          {serverError && (
            <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '2rem', border: '1px solid #f87171' }}>
              <strong>Erreur lors de l'envoi : </strong> {serverError}
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
                style={{ width: '100%', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray)', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s', backgroundColor: 'var(--color-gray-light)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Adresse Email (Optionnel)</label>
              <input
                type="email"
                name="email"
                placeholder="Ex: contact@votremail.com"
                style={{ width: '100%', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray)', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s', backgroundColor: 'var(--color-gray-light)' }}
              />
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
                <input type="radio" name="situationVehicule" value="immatricule" checked={situation === 'immatricule'} onChange={(e) => { setSituation(e.target.value); setRectoFile(null); setVersoFile(null); }} />
                <span>Véhicule déjà immatriculé (Carte Grise)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="radio" name="situationVehicule" value="non_immatricule" checked={situation === 'non_immatricule'} onChange={(e) => { setSituation(e.target.value); setRectoFile(null); setVersoFile(null); }} />
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
                  onFileAccepted={setCmcFile}
                  isPdfOk={true}
                  errorMsg={serverError?.includes('CMC') ? serverError : undefined}
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
                  onFileAccepted={setRectoFile}
                  errorMsg={serverError?.includes('recto') ? serverError : undefined}
                />
              </div>

              <div style={{ minHeight: '200px' }}>
                <DocumentScanner
                  name="verso"
                  label="Carte Grise (Verso)"
                  accept=".jpg,.jpeg,.png"
                  onFileAccepted={setVersoFile}
                  errorMsg={serverError?.includes('verso') ? serverError : undefined}
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
              box-shadow: 0 10px 25px rgba(37, 99, 235, 0.3);
            }
            .btn-submit.loading {
              background: linear-gradient(135deg, var(--color-primary), #1e40af);
              box-shadow: 0 10px 30px rgba(37, 99, 235, 0.6);
              animation: pulse-glow 1.5s infinite alternate;
            }
            @keyframes pulse-glow {
              from { transform: scale(1); box-shadow: 0 10px 20px rgba(37, 99, 235, 0.5); }
              to { transform: scale(1.02); box-shadow: 0 15px 35px rgba(37, 99, 235, 0.7); }
            }
            .fly-plane {
              animation: fly-away 0.6s forwards cubic-bezier(0.4, 0, 0.2, 1);
            }
            @keyframes fly-away {
              0% { transform: translate(0, 0) scale(1); opacity: 1; }
              100% { transform: translate(50px, -50px) scale(0.5); opacity: 0; }
            }
            .hover-plane {
              transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .dots-loader span {
              animation: dots 1.4s infinite ease-in-out both;
              display: inline-block;
              width: 6px;
              height: 6px;
              background-color: white;
              border-radius: 50%;
              margin: 0 3px;
            }
            .dots-loader span:nth-child(1) { animation-delay: -0.32s; }
            .dots-loader span:nth-child(2) { animation-delay: -0.16s; }
            @keyframes dots {
              0%, 80%, 100% { transform: scale(0.5); opacity: 0.3; }
              40% { transform: scale(1); opacity: 1; }
            }
          `}</style>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`btn btn-primary btn-submit ${isSubmitting ? 'loading' : ''}`}
            style={{ width: '100%', height: '64px', padding: '0', borderRadius: 'var(--radius-lg)', position: 'relative', border: 'none', color: 'white', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
          >
            {/* Loading State */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', opacity: isSubmitting ? 1 : 0, transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', transform: isSubmitting ? 'translateY(0)' : 'translateY(20px)', pointerEvents: 'none' }}>
              <span style={{ fontWeight: 600, fontSize: '1.125rem', letterSpacing: '0.5px' }}>Préparation du dossier</span>
              <div className="dots-loader" style={{ display: 'flex', alignItems: 'center', marginTop: '4px' }}>
                <span></span><span></span><span></span>
              </div>
            </div>

            {/* Default State */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', opacity: isSubmitting ? 0 : 1, transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', transform: isSubmitting ? 'translateY(-20px)' : 'translateY(0)', pointerEvents: 'none' }}>
              <span style={{ fontWeight: 600, fontSize: '1.125rem', letterSpacing: '0.5px' }}>Envoyer la demande</span>
              <svg className={isSubmitting ? 'fly-plane' : 'hover-plane'} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </div>
          </button>
        </form>
      </div>
    </main>
  );
}
