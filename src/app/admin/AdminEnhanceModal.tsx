'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function AdminEnhanceModal({
  isOpen,
  onClose,
  document,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  document: any;
  onSuccess: (documentId: string, newEnhancedPath: string) => void;
}) {
  const [enhanceMode, setEnhanceMode] = useState<'Auto' | 'Clair' | 'Noir & Blanc'>('Auto');
  const [enhanceBrightness, setEnhanceBrightness] = useState(1.05);
  const [enhanceContrast, setEnhanceContrast] = useState(1.05);
  const [enhanceSharpness, setEnhanceSharpness] = useState(0.5);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isApplyingEnhance, setIsApplyingEnhance] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const previewSequenceRef = useRef<number>(0);

  // Initialisation lors de l'ouverture
  useEffect(() => {
    if (isOpen && document) {
      setEnhanceMode('Auto');
      setEnhanceBrightness(1.05);
      setEnhanceContrast(1.05);
      setEnhanceSharpness(0);
      setPreviewUrl(null);
    }
  }, [isOpen, document]);

  const handleEnhanceModeChange = (mode: 'Auto' | 'Clair' | 'Noir & Blanc') => {
    setEnhanceMode(mode);
    if (mode === 'Auto') {
      setEnhanceBrightness(1.05);
      setEnhanceContrast(1.05);
      setEnhanceSharpness(0);
    } else if (mode === 'Clair') {
      setEnhanceBrightness(1.15);
      setEnhanceContrast(1.10);
      setEnhanceSharpness(0);
    } else if (mode === 'Noir & Blanc') {
      setEnhanceBrightness(1.00);
      setEnhanceContrast(1.10);
      setEnhanceSharpness(0.5);
    }
  };

  useEffect(() => {
    if (!isOpen || !document) return;

    const fetchPreview = async () => {
      setIsPreviewLoading(true);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const seq = ++previewSequenceRef.current;

      try {
        const res = await fetch(`/api/admin/documents/${document.id}/enhance-preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: enhanceMode,
            brightness: enhanceBrightness,
            contrast: enhanceContrast,
            sharpness: enhanceSharpness
          }),
          signal: abortControllerRef.current.signal
        });

        if (!res.ok) throw new Error("Erreur preview");
        const blob = await res.blob();

        if (seq === previewSequenceRef.current) {
          const objectUrl = URL.createObjectURL(blob);
          setPreviewUrl(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return objectUrl;
          });
          setIsPreviewLoading(false);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError' && seq === previewSequenceRef.current) {
          console.error(err);
          setIsPreviewLoading(false);
        }
      }
    };

    const timer = setTimeout(fetchPreview, 500);
    return () => clearTimeout(timer);
  }, [enhanceMode, enhanceBrightness, enhanceContrast, enhanceSharpness, isOpen, document]);

  useEffect(() => {
    if (!isOpen && previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [isOpen, previewUrl]);

  const handleApply = async () => {
    if (!document) return;
    setIsApplyingEnhance(true);
    try {
      const response = await fetch(`/api/admin/documents/${document.id}/enhance-apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: enhanceMode,
          brightness: enhanceBrightness,
          contrast: enhanceContrast,
          sharpness: enhanceSharpness
        })
      });
      const res = await response.json();
      if (response.ok && res.success && res.enhancedStoragePath) {
        onSuccess(document.id, res.enhancedStoragePath);
        onClose();
      } else {
        alert(res.error || "Erreur lors de l'application.");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur réseau lors de l'application.");
    } finally {
      setIsApplyingEnhance(false);
    }
  };

  if (!isOpen || !document) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(4px)', padding: '2rem' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '1rem', width: '100%', maxWidth: '1200px', height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>

        {/* Header */}
        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0F172A' }}>Amélioration de l'image</h2>
            <p style={{ margin: 0, color: '#64748B', fontSize: '0.875rem' }}>Document : {document.type} ({document.side})</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: '0.5rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Main Previews */}
          <div style={{ flex: 1, display: 'flex', backgroundColor: '#F1F5F9', padding: '1.5rem', gap: '1.5rem', overflow: 'hidden' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Original</h3>
              <div style={{ flex: 1, backgroundColor: '#fff', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid #E2E8F0', position: 'relative' }}>
                <img src={`/api/documents/${document.id}?version=original`} alt="Original" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Aperçu</h3>
              <div style={{ flex: 1, backgroundColor: '#fff', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid #E2E8F0', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {previewUrl ? (
                  <>
                    <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain', transition: 'opacity 0.2s', opacity: isPreviewLoading ? 0.5 : 1 }} />
                    {isPreviewLoading && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.7)', gap: '0.5rem' }}>
                        <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
                        <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>Génération de l'aperçu...</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ color: '#94A3B8' }}>Génération...</div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Settings */}
          <div style={{ width: '300px', borderLeft: '1px solid #E2E8F0', backgroundColor: '#fff', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', overflowY: 'auto' }}>

            <div>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mode</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(['Auto', 'Clair', 'Noir & Blanc'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => handleEnhanceModeChange(m)}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      border: '2px solid',
                      borderColor: enhanceMode === m ? 'var(--color-primary)' : '#E2E8F0',
                      backgroundColor: enhanceMode === m ? 'var(--color-primary-light)' : '#fff',
                      color: enhanceMode === m ? 'var(--color-primary)' : '#475569',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Réglages manuels</h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>
                    <span>Luminosité</span>
                    <span>{enhanceBrightness.toFixed(2)}</span>
                  </div>
                  <input type="range" min="0.85" max="1.25" step="0.01" value={enhanceBrightness} onChange={e => setEnhanceBrightness(parseFloat(e.target.value))} style={{ width: '100%', accentColor: 'var(--color-primary)' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>
                    <span>Contraste</span>
                    <span>{enhanceContrast.toFixed(2)}</span>
                  </div>
                  <input type="range" min="0.85" max="1.25" step="0.01" value={enhanceContrast} onChange={e => setEnhanceContrast(parseFloat(e.target.value))} style={{ width: '100%', accentColor: 'var(--color-primary)' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>
                    <span>Netteté</span>
                    <span>{enhanceSharpness.toFixed(1)}</span>
                  </div>
                  <input type="range" min="0" max="2" step="0.1" value={enhanceSharpness} onChange={e => setEnhanceSharpness(parseFloat(e.target.value))} style={{ width: '100%', accentColor: 'var(--color-primary)' }} />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button onClick={onClose} disabled={isApplyingEnhance} style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 600, border: '1px solid #CBD5E1', backgroundColor: '#fff', color: '#475569', cursor: 'pointer' }}>
            Annuler
          </button>
          <button onClick={handleApply} disabled={isApplyingEnhance || isPreviewLoading} style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 700, border: 'none', backgroundColor: 'var(--color-primary)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isApplyingEnhance ? 'Enregistrement...' : 'Appliquer cette amélioration'}
          </button>
        </div>

      </div>
    </div>
  );
}
