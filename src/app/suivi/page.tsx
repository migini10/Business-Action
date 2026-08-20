'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { getDossier } from '@/app/actions/suivi';

export default function Suivi() {
  const [method, setMethod] = useState<'telephone' | 'dossier'>('telephone');
  const [isSearching, setIsSearching] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const [dossierData, setDossierData] = useState<any>(null);

  const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSearching(true);

    const formData = new FormData(e.currentTarget);
    const identifier = formData.get('identifier') as string;

    const result = await getDossier(identifier, method);

    setIsSearching(false);
    if (result.success && result.dossier) {
      setDossierData(result.dossier);
      setHasResult(true);
    } else {
      alert(result.error || "Une erreur est survenue.");
    }
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
                    name="identifier"
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
                    name="identifier"
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
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>Dossier: {dossierData?.numeroDossier}</h2>
                <p style={{ color: 'var(--color-text-muted)', margin: '0.5rem 0 0 0', textTransform: 'capitalize' }}>Véhicule {dossierData?.typeVehicule?.toLowerCase().replace('_', ' ')} • Lié au {dossierData?.phone}</p>
              </div>
              <span style={{ padding: '0.5rem 1rem', backgroundColor: dossierData?.statut === 'VALIDE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: dossierData?.statut === 'VALIDE' ? 'var(--color-success)' : 'var(--color-warning)', borderRadius: '2rem', fontWeight: 600, fontSize: '0.875rem' }}>{dossierData?.statut?.replace('_', ' ')}</span>
            </div>

            <div style={{ position: 'relative', paddingLeft: '2rem', margin: '3rem 0' }}>
              <div style={{ position: 'absolute', left: '7px', top: 0, bottom: 0, width: '2px', backgroundColor: 'var(--color-gray)' }}></div>

              <div style={{ position: 'relative', marginBottom: '2.5rem' }}>
                <div style={{ position: 'absolute', left: '-2rem', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'var(--color-success)', border: '4px solid #fff', outline: '2px solid var(--color-success)', zIndex: 1 }}></div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--color-text-main)' }}>Demande reçue</h3>
                <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '0.875rem' }}>{dossierData?.createdAt ? new Date(dossierData.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute:'2-digit' }) : "Date inconnue"}</p>
              </div>

              <div style={{ position: 'relative', marginBottom: '2.5rem' }}>
                <div style={{ position: 'absolute', left: '-2rem', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: ['EN_TRAITEMENT', 'OFFRE_ENVOYEE', 'VALIDE'].includes(dossierData?.statut) ? 'var(--color-success)' : 'var(--color-warning)', border: '4px solid #fff', outline: `2px solid ${['EN_TRAITEMENT', 'OFFRE_ENVOYEE', 'VALIDE'].includes(dossierData?.statut) ? 'var(--color-success)' : 'var(--color-warning)'}`, zIndex: 1 }}></div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--color-text-main)' }}>Analyse du dossier</h3>
                <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '0.875rem' }}>{['EN_TRAITEMENT', 'OFFRE_ENVOYEE', 'VALIDE'].includes(dossierData?.statut) ? 'Analyse complétée.' : 'En cours de traitement par nos agents.'}</p>
              </div>

              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '-2rem', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: ['OFFRE_ENVOYEE', 'VALIDE'].includes(dossierData?.statut) ? 'var(--color-success)' : 'var(--color-gray)', border: '4px solid #fff', outline: `2px solid ${['OFFRE_ENVOYEE', 'VALIDE'].includes(dossierData?.statut) ? 'var(--color-success)' : 'var(--color-gray)'}`, zIndex: 1 }}></div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: ['OFFRE_ENVOYEE', 'VALIDE'].includes(dossierData?.statut) ? 'var(--color-text-main)' : 'var(--color-text-muted)' }}>Offre prête</h3>
                <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '0.875rem', marginBottom: dossierData?.devisUrl ? '1rem' : '0' }}>{['OFFRE_ENVOYEE', 'VALIDE'].includes(dossierData?.statut) ? 'Votre devis est prêt. Vous pouvez le consulter ci-dessous.' : 'À venir'}</p>

                {dossierData?.devisUrl && (
                  <div style={{ marginTop: '1rem' }}>
                    <a href={dossierData.devisUrl} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', fontSize: '1rem', backgroundColor: 'var(--color-primary)', color: 'white', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 600 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                      Voir / Télécharger mon Devis
                    </a>
                  </div>
                )}
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
