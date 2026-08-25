'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { searchDossiers, unlockDossierDocuments } from '@/app/actions/suivi';
import { useToast } from '@/components/ui/ToastProvider';
import DocumentViewerModal from '@/components/ui/DocumentViewerModal';

export default function Suivi() {
  const [searchMode, setSearchMode] = useState<'dossier' | 'phone'>('dossier');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [hasResult, setHasResult] = useState(false);
  const [selectedDossier, setSelectedDossier] = useState<any>(null);
  const [searchPhone, setSearchPhone] = useState('');
  const [unlockedDocuments, setUnlockedDocuments] = useState<any[] | null>(null);

  const [unlockingDossier, setUnlockingDossier] = useState<string | null>(null);
  const [unlockValue, setUnlockValue] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  const { toast } = useToast();
  const [viewerDoc, setViewerDoc] = useState<{url: string, title: string, mimeType?: string} | null>(null);

  const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSearching(true);

    const formData = new FormData(e.currentTarget);
    const numeroDossier = formData.get('numeroDossier') as string;
    const phone = formData.get('phone') as string;

    const query = searchMode === 'dossier' ? { numeroDossier } : { phone };
    const result = await searchDossiers(query);

    setIsSearching(false);
    if (result.success && result.dossiers) {
      setSearchResults(result.dossiers);
      setHasResult(true);
      setSelectedDossier(null);
      setUnlockingDossier(null);
      setUnlockValue('');
      setSearchPhone(searchMode === 'phone' ? phone : '');
      setUnlockedDocuments(null);
    } else {
      toast({ type: 'error', message: result.error || "Une erreur est survenue." });
    }
  };

  const handleUnlock = async (dossierNumber: string) => {
    setIsUnlocking(true);
    let nDossier = dossierNumber;
    let ph = unlockValue;

    if (searchMode === 'dossier') {
      ph = unlockValue;
    } else {
      nDossier = unlockValue;
      ph = searchPhone;
    }

    const result = await unlockDossierDocuments(nDossier, ph);
    setIsUnlocking(false);

    if (result.success) {
      setUnlockedDocuments(result.documents || []);
      setUnlockingDossier(null);
      setUnlockValue('');
    } else {
      toast({ type: 'error', message: result.error || "Informations de vérification incorrectes." });
    }
  };

  const renderDossierCard = (dossierData: any, index: number) => (
    <div
      key={index}
      className="card animate-fade-in dossier-card"
      onClick={() => setSelectedDossier(dossierData)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setSelectedDossier(dossierData);
        }
      }}
      aria-label={`Voir le détail du dossier ${dossierData.numeroDossier}`}
      style={{ padding: '2rem', borderRadius: 'var(--radius-2xl)', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', height: '100%', outlineOffset: '2px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>Dossier: {dossierData.numeroDossier}</h2>
          <p style={{ color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0', textTransform: 'capitalize', fontSize: '0.875rem' }}>Véhicule {dossierData.typeVehicule?.toLowerCase().replace('_', ' ')}</p>
        </div>
        <span style={{ padding: '0.5rem 1rem', backgroundColor: dossierData.statut === 'VALIDE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: dossierData.statut === 'VALIDE' ? 'var(--color-success)' : 'var(--color-warning)', borderRadius: '2rem', fontWeight: 600, fontSize: '0.875rem' }}>{dossierData.statut?.replace('_', ' ')}</span>
      </div>
      <div>
        <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '0.875rem' }}>
          Créé le {dossierData.createdAt ? new Date(dossierData.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "Date inconnue"}
        </p>
      </div>
    </div>
  );

  const renderDossierDetail = (dossierData: any) => (
    <div className="card animate-fade-in" style={{ padding: '2rem', borderRadius: 'var(--radius-2xl)', backgroundColor: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-gray-light)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>Dossier: {dossierData.numeroDossier}</h2>
          <p style={{ color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0', textTransform: 'capitalize', fontSize: '0.875rem' }}>Véhicule {dossierData.typeVehicule?.toLowerCase().replace('_', ' ')}</p>
        </div>
        <span style={{ padding: '0.5rem 1rem', backgroundColor: dossierData.statut === 'VALIDE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: dossierData.statut === 'VALIDE' ? 'var(--color-success)' : 'var(--color-warning)', borderRadius: '2rem', fontWeight: 600, fontSize: '0.875rem' }}>{dossierData.statut?.replace('_', ' ')}</span>
      </div>

      <div style={{ position: 'relative', paddingLeft: '2rem', margin: '2rem 0' }}>
        <div style={{ position: 'absolute', left: '7px', top: 0, bottom: 0, width: '2px', backgroundColor: 'var(--color-gray)' }}></div>

        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
          <div style={{ position: 'absolute', left: '-2rem', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'var(--color-success)', border: '4px solid #fff', outline: '2px solid var(--color-success)', zIndex: 1 }}></div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: 'var(--color-text-main)' }}>Demande reçue</h3>
          <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '0.875rem' }}>
            Créé le {dossierData.createdAt ? new Date(dossierData.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "Date inconnue"}
          </p>
        </div>

        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
          <div style={{ position: 'absolute', left: '-2rem', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: ['EN_TRAITEMENT', 'OFFRE_ENVOYEE', 'VALIDE'].includes(dossierData.statut) ? 'var(--color-success)' : 'var(--color-warning)', border: '4px solid #fff', outline: `2px solid ${['EN_TRAITEMENT', 'OFFRE_ENVOYEE', 'VALIDE'].includes(dossierData.statut) ? 'var(--color-success)' : 'var(--color-warning)'}`, zIndex: 1 }}></div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: 'var(--color-text-main)' }}>Analyse du dossier</h3>
          <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '0.875rem' }}>{['EN_TRAITEMENT', 'OFFRE_ENVOYEE', 'VALIDE'].includes(dossierData.statut) ? 'Analyse complétée.' : 'En cours de traitement par nos agents.'}</p>
        </div>

        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: '-2rem', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: ['OFFRE_ENVOYEE', 'VALIDE'].includes(dossierData.statut) ? 'var(--color-success)' : 'var(--color-gray)', border: '4px solid #fff', outline: `2px solid ${['OFFRE_ENVOYEE', 'VALIDE'].includes(dossierData.statut) ? 'var(--color-success)' : 'var(--color-gray)'}`, zIndex: 1 }}></div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: ['OFFRE_ENVOYEE', 'VALIDE'].includes(dossierData.statut) ? 'var(--color-text-main)' : 'var(--color-text-muted)' }}>Offre prête</h3>
          <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '0.875rem', marginBottom: '1rem' }}>{['OFFRE_ENVOYEE', 'VALIDE'].includes(dossierData.statut) ? 'Votre devis est prêt. Une vérification supplémentaire est requise pour y accéder.' : 'À venir'}</p>

          {dossierData.hasPrivateDocuments && unlockedDocuments === null && unlockingDossier !== dossierData.numeroDossier && (
            <div style={{ marginTop: '0.5rem' }}>
              <button type="button" onClick={() => {setUnlockingDossier(dossierData.numeroDossier); setUnlockValue('');}} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.875rem', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '0.5rem', fontWeight: 600 }}>
                Voir mes documents
              </button>
            </div>
          )}

          {unlockingDossier === dossierData.numeroDossier && (
            <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--color-gray-light)', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}>
              <p style={{ marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: 600 }}>Vérification de sécurité (Niveau 2)</p>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--color-text-main)' }}>
                    {searchMode === 'dossier' ? "Confirmez votre téléphone :" : "Confirmez le dossier COMPLET :"}
                  </label>
                  <input
                    type={searchMode === 'dossier' ? "tel" : "text"}
                    value={unlockValue}
                    onChange={(e) => setUnlockValue(e.target.value)}
                    placeholder={searchMode === 'dossier' ? "+221 77 ..." : "DOS-1234-SN"}
                    className="suivi-input"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', fontSize: '0.875rem', backgroundColor: '#fff', color: 'var(--color-text-main)' }}
                  />
                </div>
                <button
                  type="button"
                  disabled={isUnlocking || !unlockValue.trim()}
                  onClick={() => handleUnlock(searchMode === 'dossier' ? dossierData.numeroDossier : '')}
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', opacity: (isUnlocking || !unlockValue.trim()) ? 0.7 : 1, cursor: (isUnlocking || !unlockValue.trim()) ? 'not-allowed' : 'pointer', border: 'none', backgroundColor: 'var(--color-primary)', color: 'white', fontSize: '0.875rem', whiteSpace: 'nowrap' }}
                >
                  {isUnlocking ? "Vérification..." : "Déverrouiller"}
                </button>
              </div>
            </div>
          )}

          {unlockedDocuments !== null && (
            <div style={{ marginTop: '1.5rem', padding: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--color-text-main)' }}>Mes documents</h4>
              {unlockedDocuments.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: 0 }}>Aucun document disponible.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {unlockedDocuments.map(doc => {
                    const typeLabel = doc.type.replace(/_/g, ' ').toLowerCase();
                    const formattedType = typeLabel === 'cmc' ? 'certificat de mise en circulation' : typeLabel;
                    const label = doc.side && doc.side !== 'SINGLE'
                      ? `${formattedType.charAt(0).toUpperCase() + formattedType.slice(1)} — ${doc.side.charAt(0).toUpperCase() + doc.side.slice(1).toLowerCase()}`
                      : formattedType.charAt(0).toUpperCase() + formattedType.slice(1);
                    return (
                      <button
                        key={doc.id}
                        onClick={() => setViewerDoc({ url: `/api/documents/${doc.id}`, title: label, mimeType: doc.mimeType })}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', backgroundColor: '#fff', border: '1px solid #d1d5db', borderRadius: '0.5rem', cursor: 'pointer', textAlign: 'left' }}
                        className="dossier-card"
                      >
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-main)' }}>{label}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{new Date(doc.uploadedAt).toLocaleDateString('fr-FR')}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <main style={{ minHeight: '80vh', padding: '4rem 2rem' }}>
      <style>{`
        .dossier-card {
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .dossier-card:hover, .dossier-card:focus-visible {
          transform: translateY(-4px);
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          outline: 2px solid var(--color-primary);
        }
        .suivi-input:focus {
          outline: 2px solid var(--color-primary);
          outline-offset: 2px;
          border-color: var(--color-primary) !important;
        }
      `}</style>
      <div className="container" style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: '1rem' }}>Suivi de Dossier</h1>
          <p style={{ fontSize: '1.25rem', color: 'var(--color-text-muted)', maxWidth: '600px', margin: '0 auto' }}>
            Consultez l'avancement de votre demande de devis.
          </p>
        </div>

        {!hasResult ? (
          <div className="card animate-fade-in" style={{ padding: '3rem', borderRadius: 'var(--radius-2xl)', backgroundColor: '#fff', maxWidth: '600px', margin: '0 auto' }}>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
              <button
                type="button"
                onClick={() => setSearchMode('dossier')}
                style={{ flex: 1, padding: '1rem', borderRadius: '0.5rem', fontWeight: 600, border: '1px solid', borderColor: searchMode === 'dossier' ? 'var(--color-primary)' : 'var(--color-gray)', backgroundColor: searchMode === 'dossier' ? 'rgba(16, 185, 129, 0.1)' : 'transparent', color: searchMode === 'dossier' ? 'var(--color-primary)' : 'var(--color-text-main)', cursor: 'pointer' }}
              >
                Par Numéro de Dossier
              </button>
              <button
                type="button"
                onClick={() => setSearchMode('phone')}
                style={{ flex: 1, padding: '1rem', borderRadius: '0.5rem', fontWeight: 600, border: '1px solid', borderColor: searchMode === 'phone' ? 'var(--color-primary)' : 'var(--color-gray)', backgroundColor: searchMode === 'phone' ? 'rgba(16, 185, 129, 0.1)' : 'transparent', color: searchMode === 'phone' ? 'var(--color-primary)' : 'var(--color-text-main)', cursor: 'pointer' }}
              >
                Par Téléphone
              </button>
            </div>

            <form onSubmit={handleSearch}>
              <div style={{ marginBottom: '2rem' }}>
                {searchMode === 'dossier' ? (
                  <div>
                    <label style={{ display: 'block', fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Votre Numéro de Dossier</label>
                    <input
                      type="text"
                      name="numeroDossier"
                      required
                      placeholder="Ex: DOS-1234-SN"
                      className="suivi-input"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid #d1d5db', fontSize: '1.125rem', backgroundColor: '#fff', textTransform: 'uppercase', color: 'var(--color-text-main)' }}
                    />
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Votre numéro WhatsApp</label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      placeholder="Ex: +221 77 123 45 67"
                      className="suivi-input"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid #d1d5db', fontSize: '1.125rem', backgroundColor: '#fff', color: 'var(--color-text-main)' }}
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSearching}
                className="btn btn-primary"
                style={{ width: '100%', padding: '1.25rem', fontSize: '1.125rem', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', opacity: isSearching ? 0.7 : 1, cursor: isSearching ? 'not-allowed' : 'pointer', border: 'none', backgroundColor: 'var(--color-primary)', color: 'white' }}
              >
                {isSearching ? "Recherche..." : "Rechercher"}
              </button>
            </form>
          </div>
        ) : selectedDossier ? (
          <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem' }}>
              <button
                onClick={() => { setSelectedDossier(null); setUnlockingDossier(null); setUnlockValue(''); setUnlockedDocuments(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0 }}
              >
                &larr; Retour aux résultats
              </button>
            </div>
            {renderDossierDetail(selectedDossier)}
          </div>
        ) : (
          <div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: searchResults.length > 1 ? 'repeat(auto-fit, minmax(320px, 1fr))' : 'minmax(auto, 800px)',
              justifyContent: 'center',
              gap: '1.5rem',
              alignItems: 'stretch'
            }}>
              {searchResults.map((dossier, index) => renderDossierCard(dossier, index))}
            </div>
            <div style={{ textAlign: 'center', marginTop: '3rem' }}>
              <button onClick={() => { setHasResult(false); setSearchResults([]); }} className="btn btn-secondary" style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', cursor: 'pointer', border: '1px solid var(--color-gray)', backgroundColor: '#fff' }}>Nouvelle recherche</button>
            </div>
          </div>
        )}

      </div>

      <DocumentViewerModal
        open={viewerDoc !== null}
        onClose={() => setViewerDoc(null)}
        documentUrl={viewerDoc?.url || ''}
        title={viewerDoc?.title || ''}
        mimeType={viewerDoc?.mimeType}
      />
    </main>
  );
}
