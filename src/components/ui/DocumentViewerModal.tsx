'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface DocumentViewerModalProps {
  open: boolean;
  onClose: () => void;
  documentUrl: string;
  mimeType?: string;
  title: string;
}

export default function DocumentViewerModal({ open, onClose, documentUrl, mimeType, title }: DocumentViewerModalProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isPdf = documentUrl.toLowerCase().includes('.pdf') || mimeType === 'application/pdf';

  useEffect(() => {
    if (open) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open, documentUrl]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const clampPosition = useCallback((x: number, y: number, currentScale: number) => {
    if (!viewportRef.current || !imageRef.current) return { x: 0, y: 0 };

    if (currentScale === 1) return { x: 0, y: 0 };

    const viewportWidth = viewportRef.current.clientWidth;
    const viewportHeight = viewportRef.current.clientHeight;
    const baseWidth = imageRef.current.clientWidth;
    const baseHeight = imageRef.current.clientHeight;

    const scaledWidth = baseWidth * currentScale;
    const scaledHeight = baseHeight * currentScale;

    const maxX = Math.max(0, (scaledWidth - viewportWidth) / 2);
    const maxY = Math.max(0, (scaledHeight - viewportHeight) / 2);

    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y))
    };
  }, []);

  useEffect(() => {
    if (!viewportRef.current || !open || isPdf) return;
    const observer = new ResizeObserver(() => {
      setPosition(prev => clampPosition(prev.x, prev.y, scale));
    });
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [scale, clampPosition, open, isPdf]);

  const handleZoomIn = () => setScale(s => {
    const newScale = Math.min(s + 0.5, 4);
    setPosition(prev => clampPosition(prev.x, prev.y, newScale));
    return newScale;
  });

  const handleZoomOut = () => setScale(s => {
    const newScale = Math.max(s - 0.5, 1);
    setPosition(prev => clampPosition(prev.x, prev.y, newScale));
    return newScale;
  });

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (isPdf) return;
    e.preventDefault();
    if (e.deltaY < 0) handleZoomIn();
    else handleZoomOut();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isPdf || scale === 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale === 1) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    setPosition(clampPosition(newX, newY, scale));
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isPdf || scale === 1 || e.touches.length !== 1) return;
    setIsDragging(true);
    setDragStart({ x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || scale === 1 || e.touches.length !== 1) return;
    const newX = e.touches[0].clientX - dragStart.x;
    const newY = e.touches[0].clientY - dragStart.y;
    setPosition(clampPosition(newX, newY, scale));
  };

  const handleTouchEnd = () => setIsDragging(false);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column'
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Visionneuse de document"
    >
      <div
        style={{
          padding: '1rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)',
          color: 'white',
          zIndex: 2
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>{title}</h3>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {!isPdf && (
            <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'rgba(255,255,255,0.1)', padding: '0.25rem', borderRadius: '0.5rem' }}>
              <button type="button" onClick={handleZoomOut} aria-label="Dézoomer" style={controlBtnStyle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
              </button>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, minWidth: '3.5ch', textAlign: 'center', lineHeight: '32px', userSelect: 'none' }}>
                {Math.round(scale * 100)}%
              </span>
              <button type="button" onClick={handleZoomIn} aria-label="Zoomer" style={controlBtnStyle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
              </button>
              <button type="button" onClick={handleReset} aria-label="Adapter à l'écran" style={controlBtnStyle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
              </button>
            </div>
          )}
          <button type="button" onClick={onClose} aria-label="Fermer la visionneuse" style={{ ...controlBtnStyle, backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#FCA5A5' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative'
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onClick={e => e.stopPropagation()}
      >
        {isPdf ? (
          <object
            data={documentUrl}
            type="application/pdf"
            style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#F1F5F9' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', color: '#94A3B8', padding: '2rem', textAlign: 'center' }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              <p style={{ margin: 0, fontSize: '1.125rem', color: 'white' }}>Affichage interne impossible sur ce navigateur</p>
              <a href={documentUrl} download aria-label="Télécharger le document PDF" style={{ textDecoration: 'none', color: 'white', backgroundColor: 'var(--color-primary)', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                Télécharger le PDF
              </a>
            </div>
          </object>
        ) : (
          <div
            style={{
              transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
            }}
          >
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
                transition: isDragging ? 'none' : 'transform 0.2s ease-out'
              }}
            >
              <img
                ref={imageRef}
                src={documentUrl}
                alt={title}
                draggable={false}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  pointerEvents: 'none'
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

const controlBtnStyle: React.CSSProperties = {
  width: '36px',
  height: '36px',
  borderRadius: '0.375rem',
  border: 'none',
  background: 'transparent',
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background 0.2s'
};
