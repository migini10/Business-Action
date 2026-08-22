'use client';

import React, { useState, useRef, useEffect, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import { createPortal } from 'react-dom';
import loadImage from 'blueimp-load-image';
import { evaluatePhysicalReadability, detectDocumentCorners, applyPerspectiveWarp } from '@/lib/cv-processor';
import { convertIfHeic, MAX_SOURCE_FILE_SIZE, MAX_FINAL_FILE_SIZE } from '@/lib/heic-converter';

interface Point { x: number; y: number; }

interface DocumentScannerProps {
  name: string;
  label: string;
  accept?: string;
  onFileAccepted: (file: File | null) => void;
  errorMsg?: string | null;
  isPdfOk?: boolean;
}

const MIN_AREA_RATIO = 0.1;
const HANDLE_RADIUS = 15;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.5;

type ScanMode = 'CROP' | 'PREVIEW' | 'DONE';

function isConvexAndValid(points: Point[]): boolean {
  if (points[0].x >= points[1].x) return false;
  if (points[3].x >= points[2].x) return false;
  if (points[0].y >= points[3].y) return false;
  if (points[1].y >= points[2].y) return false;

  for (let i = 0; i < 4; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % 4];
    const p3 = points[(i + 2) % 4];
    const cross = (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x);
    if (cross < 0) return false;
  }

  const area1 = 0.5 * Math.abs(points[0].x*points[1].y + points[1].x*points[2].y + points[2].x*points[0].y - points[1].x*points[0].y - points[2].x*points[1].y - points[0].x*points[2].y);
  const area2 = 0.5 * Math.abs(points[2].x*points[3].y + points[3].x*points[0].y + points[0].x*points[2].y - points[3].x*points[2].y - points[0].x*points[3].y - points[2].x*points[0].y);
  const area = area1 + area2;

  if (area < MIN_AREA_RATIO) return false;

  return true;
}

export default function DocumentScanner({ name, label, onFileAccepted, errorMsg, isPdfOk = false }: DocumentScannerProps) {
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [finalThumbnailUrl, setFinalThumbnailUrl] = useState<string | null>(null);

  const [scanMode, setScanMode] = useState<ScanMode>('DONE');
  const [localError, setLocalError] = useState<string | null>(errorMsg || null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [hqCanvas, setHqCanvas] = useState<HTMLCanvasElement | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [rectifiedPreviewSrc, setRectifiedPreviewSrc] = useState<string | null>(null);

  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const [renderedDims, setRenderedDims] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);

  const [corners, setCorners] = useState<Point[]>([
    { x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 }
  ]);

  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);


  const imageWrapperRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: 0, y: 0 });

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 });

  const clampPan = (newPanX: number, newPanY: number, currentZoom: number) => {
    if (currentZoom <= 1 || !imageWrapperRef.current || !viewportRef.current) return { x: 0, y: 0 };

    const imgW = imageWrapperRef.current.offsetWidth;
    const imgH = imageWrapperRef.current.offsetHeight;
    const viewW = viewportRef.current.clientWidth;
    const viewH = viewportRef.current.clientHeight;

    const scaledW = imgW * currentZoom;
    const scaledH = imgH * currentZoom;

    const maxX = Math.max(0, (scaledW - viewW) / 2);
    const maxY = Math.max(0, (scaledH - viewH) / 2);

    return {
      x: Math.max(-maxX, Math.min(maxX, newPanX)),
      y: Math.max(-maxY, Math.min(maxY, newPanY))
    };
  };

  const updateLoupe = (c: Point) => {
    if (!hqCanvas || !loupeCanvasRef.current) return;
    requestAnimationFrame(() => {
      const canvas = loupeCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const renderedImg = imageWrapperRef.current;
      if (!renderedImg) return;

      const ratioX = hqCanvas.width / renderedImg.offsetWidth;
      const ratioY = hqCanvas.height / renderedImg.offsetHeight;

      const srcCropW = (160 / 3) * ratioX;
      const srcCropH = (160 / 3) * ratioY;

      const srcX = c.x * hqCanvas.width - srcCropW / 2;
      const srcY = c.y * hqCanvas.height - srcCropH / 2;

      ctx.clearRect(0, 0, 160, 160);
      ctx.drawImage(hqCanvas, srcX, srcY, srcCropW, srcCropH, 0, 0, 160, 160);

      ctx.beginPath();
      ctx.moveTo(80, 70); ctx.lineTo(80, 90);
      ctx.moveTo(70, 80); ctx.lineTo(90, 80);
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  };

  const [clientMounted, setClientMounted] = useState(false);

  useEffect(() => {
    setClientMounted(true);
  }, []);

  useEffect(() => {
    if (scanMode !== 'CROP' && scanMode !== 'PREVIEW') return;

    const handleResize = () => {
      if (!viewportRef.current || imgSize.width === 0 || imgSize.height === 0) return;
      const viewportWidth = viewportRef.current.clientWidth;
      const viewportHeight = viewportRef.current.clientHeight;

      const fitScale = Math.min(
        viewportWidth / imgSize.width,
        viewportHeight / imgSize.height
      );

      setRenderedDims({
        width: imgSize.width * fitScale,
        height: imgSize.height * fitScale
      });
    };

    handleResize();

    window.addEventListener('resize', handleResize);
    let ro: ResizeObserver | null = null;
    if (viewportRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(handleResize);
      ro.observe(viewportRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (ro) ro.disconnect();
    };
  }, [scanMode, imgSize]);


  useEffect(() => {
    let previousOverflow = '';
    if (scanMode === 'CROP' || scanMode === 'PREVIEW') {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    return () => {
      if (scanMode === 'CROP' || scanMode === 'PREVIEW') {
        document.body.style.overflow = previousOverflow;
      }
    };
  }, [scanMode]);

  useEffect(() => {
    setLocalError(errorMsg || null);
  }, [errorMsg]);

  useEffect(() => {
    return () => {
      if (finalThumbnailUrl) URL.revokeObjectURL(finalThumbnailUrl);
    };
  }, [finalThumbnailUrl]);

  const resetState = () => {
    setLocalError(null);
    setCurrentFile(null);
    onFileAccepted(null);
    setScanMode('DONE');
    if (finalThumbnailUrl) {
      URL.revokeObjectURL(finalThumbnailUrl);
      setFinalThumbnailUrl(null);
    }
  };

  const processImageFile = (f: File) => {
    setIsProcessing(true);
    loadImage(f, async (img: Event | HTMLCanvasElement | HTMLImageElement) => {
      if ((img as Event).type === 'error') {
        setLocalError("Erreur de lecture de l'image.");
        setIsProcessing(false);
        return;
      }
      const canvasHQ = img as HTMLCanvasElement;
      setHqCanvas(canvasHQ);

      const prevCanvas = document.createElement('canvas');
      const scale = Math.min(800 / canvasHQ.width, 800 / canvasHQ.height, 1);
      prevCanvas.width = canvasHQ.width * scale;
      prevCanvas.height = canvasHQ.height * scale;
      const ctx = prevCanvas.getContext('2d');
      ctx?.drawImage(canvasHQ, 0, 0, prevCanvas.width, prevCanvas.height);
      setPreviewSrc(prevCanvas.toDataURL('image/jpeg', 0.8));
      setZoom(1);
      setScanMode('CROP');
      try {
        const detected = await detectDocumentCorners(prevCanvas);
        if (detected && detected.length === 4) {
          const norm = detected.map(p => ({
            x: Math.min(Math.max(p.x / prevCanvas.width, 0), 1),
            y: Math.min(Math.max(p.y / prevCanvas.height, 0), 1)
          }));

          const center = norm.reduce((acc, p) => ({ x: acc.x + p.x/4, y: acc.y + p.y/4 }), {x:0, y:0});
          norm.sort((a, b) => {
            const a1 = Math.atan2(a.y - center.y, a.x - center.x);
            const a2 = Math.atan2(b.y - center.y, b.x - center.x);
            return a1 - a2;
          });

          const sorted = [...norm];
          sorted.sort((a, b) => (a.x + a.y) - (b.x + b.y));
          const TL = sorted[0];
          const BR = sorted[3];
          const rem = [sorted[1], sorted[2]];
          rem.sort((a, b) => a.x - b.x);
          const TR = rem[0].y < rem[1].y ? rem[0] : rem[1];
          const BL = rem[0].y < rem[1].y ? rem[1] : rem[0];

          const newCorners = [TL, TR, BR, BL];
          if (isConvexAndValid(newCorners)) {
            setCorners(newCorners);
          }
        } else {
        }
      } catch(e: any) {
        console.warn("OpenCV Auto-detect failed, switching to manual", e);
      }

      setIsProcessing(false);
    }, { maxWidth: 2000, maxHeight: 2000, orientation: true, canvas: true });
  };

  const handleInputPointerDown = () => {
  };

  const handleInputClick = (type: 'camera' | 'gallery' | 'pdf') => {

  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const originalFile = e.target.files?.[0];

    if (!originalFile) {
      return;
    }

    if (originalFile.size > MAX_SOURCE_FILE_SIZE) {
      setLocalError("Le fichier est trop volumineux (max 15 MB). Veuillez choisir une autre photo.");
      e.target.value = '';
      return;
    }

    let f = originalFile;
    try {
      setIsProcessing(true);
      if (originalFile.type.startsWith('image/heic') || originalFile.type.startsWith('image/heif') || originalFile.name.match(/\.hei[cf]$/i)) {
        setLocalError(null);
      }
      f = await convertIfHeic(originalFile);
    } catch(err) {
      console.error("HEIC conversion failed:", err);
      setLocalError("Cette photo n'a pas pu être convertie. Veuillez reprendre la photo ou choisir une autre image.");
      setIsProcessing(false);
      e.target.value = '';
      return;
    } finally {
      setIsProcessing(false);
    }

    resetState();

    if (f.type === 'application/pdf' && isPdfOk) {
      setCurrentFile(f);
      onFileAccepted(f);
      return;
    }

    if (!f.type.startsWith('image/')) {
      setLocalError("Veuillez sélectionner une image.");
      return;
    }

    processImageFile(f);
    e.target.value = '';
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (zoom <= 1) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsPanning(true);
    pointerRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    setPointerPos({ x: e.clientX, y: e.clientY });

    if (isPanning) {
      const dx = e.clientX - pointerRef.current.x;
      const dy = e.clientY - pointerRef.current.y;
      pointerRef.current = { x: e.clientX, y: e.clientY };
      setPan(p => clampPan(p.x + dx, p.y + dy, zoom));
      return;
    }

    if (draggingIdx !== null && imageWrapperRef.current) {
      const rect = imageWrapperRef.current.getBoundingClientRect();
      let x = (e.clientX - rect.left) / rect.width;
      let y = (e.clientY - rect.top) / rect.height;

      x = Math.max(0, Math.min(1, x));
      y = Math.max(0, Math.min(1, y));

      const newCorners = [...corners];
      newCorners[draggingIdx] = { x, y };
      if (isConvexAndValid(newCorners)) {
        setCorners(newCorners);
      }

      updateLoupe(newCorners[draggingIdx]);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    setIsPanning(false);
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    setIsPanning(false);
  };

  const handleCornerPointerDown = (idx: number, e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingIdx(idx);
    setPointerPos({ x: e.clientX, y: e.clientY });
    updateLoupe(corners[idx]);
  };

  const handleCornerPointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDraggingIdx(null);
  };

  const handlePreview = async () => {
    if (!hqCanvas) return;
    setIsProcessing(true);
    try {
      const warpedCanvas = await applyPerspectiveWarp(hqCanvas, corners);
      setRectifiedPreviewSrc(warpedCanvas.toDataURL('image/jpeg', 0.8));
      setScanMode('PREVIEW');
    } catch(e: any) {
      console.error(e);
      setLocalError("Erreur lors de la prévisualisation.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalValidation = async () => {
    if (!hqCanvas) return;
    setIsProcessing(true);
    try {
      const warpedCanvas = await applyPerspectiveWarp(hqCanvas, corners);

      const readability = evaluatePhysicalReadability(warpedCanvas);
      if (!readability.isReadable) {
        setLocalError(`Refusé: Image floue ou mauvaise exposition. Veuillez reprendre la photo.`);
        setScanMode('DONE');
        resetState();
        return;
      }

      warpedCanvas.toBlob((blob) => {
        if (!blob) return;

        if (blob.size > MAX_FINAL_FILE_SIZE) {
          setLocalError(`Le fichier final dépasse 4 MB. Veuillez essayer avec une zone plus petite.`);
          setScanMode('DONE');
          resetState();
          return;
        }

        const newFile = new File([blob], `cropped-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setCurrentFile(newFile);
        onFileAccepted(newFile);

        const objUrl = URL.createObjectURL(blob);
        setFinalThumbnailUrl(objUrl);

        setScanMode('DONE');
      }, 'image/jpeg', 0.85);
    } catch(e: any) {
      console.error(e);
      setLocalError("Le traitement du document a échoué. Veuillez réessayer.");
      setScanMode('DONE');
      resetState();
    } finally {
      setIsProcessing(false);
    }
  };

  const zoomIn = () => setZoom(z => {
    const newZ = Math.min(z + ZOOM_STEP, MAX_ZOOM);
    setPan(p => clampPan(p.x, p.y, newZ));
    return newZ;
  });
  const zoomOut = () => setZoom(z => {
    const newZ = Math.max(z - ZOOM_STEP, MIN_ZOOM);
    setPan(p => clampPan(p.x, p.y, newZ));
    return newZ;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`
        .scanner-btn-camera { display: none; }
        .scanner-btn-gallery { display: block; }
        @media (pointer: coarse) and (hover: none) {
          .scanner-btn-camera { display: block; }
        }
      `}</style>
      <span style={{ display: 'block', fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>{label}</span>

      <div
        style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          border: '2px dashed var(--color-gray)', borderRadius: 'var(--radius-lg)',
          padding: '1.5rem', textAlign: 'center',
          backgroundColor: currentFile ? 'rgba(59, 130, 246, 0.05)' : 'var(--color-gray-light)',
          borderColor: localError ? 'red' : (currentFile ? 'var(--color-primary)' : 'var(--color-gray)'),
          transition: 'all 0.2s', flexGrow: 1, minHeight: '200px'
        }}
      >
        {isProcessing && scanMode === 'DONE' ? (
          <div style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Traitement en cours...</div>
        ) : finalThumbnailUrl ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%' }}>
            <img src={finalThumbnailUrl} alt="Document" style={{ maxHeight: '200px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
            <div style={{ backgroundColor: 'var(--color-success)', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.875rem', fontWeight: 600 }}>
              {isPdfOk ? 'CMC prêt' : name === 'recto' ? 'Recto prêt' : 'Verso prêt'}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
              {!isPdfOk && <button type="button" onClick={() => setScanMode('CROP')} className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem' }}>Modifier</button>}
              <button type="button" onClick={() => resetState()} className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>Reprendre</button>
            </div>
          </div>
        ) : currentFile && isPdfOk ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%' }}>
             <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <div style={{ backgroundColor: 'var(--color-success)', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.875rem', fontWeight: 600 }}>
              CMC prêt (PDF)
            </div>
            <button type="button" onClick={() => resetState()} className="btn btn-secondary" style={{ width: '100%', padding: '0.5rem', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>Reprendre</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={localError ? "red" : "var(--color-primary)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: '0 0 0.5rem 0' }}>
              Ajouter votre document
            </p>

            <div className="btn btn-primary scanner-btn-camera" style={{ padding: '0.75rem', width: '100%', position: 'relative', cursor: 'pointer', margin: 0 }}>
              📸 Prendre une photo
              <input
                id={`${name}-camera`}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10 }}
                onChange={handleFileChange}
                onClick={() => handleInputClick('camera')}
                onPointerDown={handleInputPointerDown}
              />
            </div>

            <div className="btn btn-secondary scanner-btn-gallery" style={{ padding: '0.75rem', width: '100%', position: 'relative', cursor: 'pointer', margin: 0 }}>
              <span className="scanner-btn-camera">🖼️ Choisir dans la galerie</span>
              <span className="scanner-btn-desktop-only" style={{ display: 'none' }}>🖼️ Choisir une image</span>
              <style>{`
                @media (pointer: fine) and (hover: hover) {
                  .scanner-btn-camera { display: none !important; }
                  .scanner-btn-desktop-only { display: inline !important; }
                }
              `}</style>
              <input
                id={`${name}-gallery`}
                type="file"
                accept="image/*"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10 }}
                onChange={handleFileChange}
                onClick={() => handleInputClick('gallery')}
                onPointerDown={handleInputPointerDown}
              />
            </div>

            {isPdfOk && (
              <div className="btn btn-secondary" style={{ padding: '0.75rem', width: '100%', position: 'relative', cursor: 'pointer', margin: 0 }}>
                📄 Document PDF
                <input
                  id={`${name}-pdf`}
                  type="file"
                  accept="application/pdf"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10 }}
                  onChange={handleFileChange}
                  onClick={() => handleInputClick('pdf')}
                  onPointerDown={handleInputPointerDown}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {localError && <div style={{ marginTop: '0.5rem', color: 'red', fontSize: '0.875rem', fontWeight: 500 }}>{localError}</div>}

      {clientMounted && (scanMode === 'CROP' || scanMode === 'PREVIEW') && previewSrc && createPortal(
        <div style={{ position: 'fixed', inset: 0, height: '100dvh', backgroundColor: '#000', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>

          {/* Header */}
          <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', padding: '1rem', backgroundColor: '#111', color: '#fff' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Ajustement</h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
               <button type="button" onClick={zoomOut} disabled={zoom <= MIN_ZOOM} style={{ padding: '0.25rem 0.75rem', background: '#333', border: 'none', color: '#fff', borderRadius: '4px' }}>-</button>
               <button type="button" onClick={zoomIn} disabled={zoom >= MAX_ZOOM} style={{ padding: '0.25rem 0.75rem', background: '#333', border: 'none', color: '#fff', borderRadius: '4px' }}>+</button>
            </div>
          </div>

          {/* Viewport */}
          <div
            ref={viewportRef}
            style={{ flex: 1, minHeight: 0, width: '100%', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
          >
            {/* PAN WRAPPER */}
            <div style={{ transform: `translate(${pan.x}px, ${pan.y}px)`, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default' }}>
              {/* ZOOM WRAPPER */}
              <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: isPanning ? 'none' : 'transform 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                <div ref={imageWrapperRef} style={{ position: 'relative', display: 'block', width: renderedDims.width > 0 ? renderedDims.width : '100%', height: renderedDims.height > 0 ? renderedDims.height : '100%' }}>

                  {scanMode === 'PREVIEW' && rectifiedPreviewSrc ? (
                    <img src={rectifiedPreviewSrc} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} alt="Preview" />
                  ) : (
                    <>
                      <img src={previewSrc} onLoad={(e) => setImgSize({width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight})} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} alt="Scanner preview" />

                      {imgSize.width > 0 && imgSize.height > 0 && (
                        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox={`0 0 ${imgSize.width} ${imgSize.height}`}>
                          <polygon
                            points={corners.map(c => `${c.x * imgSize.width},${c.y * imgSize.height}`).join(' ')}
                            fill="rgba(59, 130, 246, 0.2)"
                            stroke="var(--color-primary)"
                            strokeWidth={4 / zoom}
                          />
                        </svg>
                      )}

                      {corners.map((c, idx) => (
                        <div
                          key={idx}
                          onPointerDown={(e) => handleCornerPointerDown(idx, e)}
                          onPointerUp={handleCornerPointerUp}
                          onPointerCancel={handleCornerPointerUp}
                          style={{
                            position: 'absolute',
                            left: `${c.x * 100}%`,
                            top: `${c.y * 100}%`,
                            width: HANDLE_RADIUS * 2,
                            height: HANDLE_RADIUS * 2,
                            marginLeft: -HANDLE_RADIUS,
                            marginTop: -HANDLE_RADIUS,
                            backgroundColor: 'white',
                            border: `${2 / zoom}px solid var(--color-primary)`,
                            borderRadius: '50%',
                            cursor: 'grab',
                            pointerEvents: 'auto',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                            transform: draggingIdx === idx ? 'scale(1.2)' : 'scale(1)',
                            transition: 'transform 0.1s'
                          }}
                        />
                      ))}
                    </>
                  )}

                </div>
              </div>
            </div>
          </div>

          {/* Footer Controls */}
          <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', padding: '1rem', backgroundColor: '#111' }}>
            <button type="button" onClick={() => { setScanMode('DONE'); resetState(); }} style={{ padding: '0.75rem 1rem', border: '1px solid #444', borderRadius: '4px', background: 'transparent', color: '#fff' }}>Annuler</button>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {scanMode === 'CROP' ? (
                <>
                  <button type="button" onClick={handlePreview} disabled={isProcessing} style={{ padding: '0.75rem 1rem', border: '1px solid var(--color-primary)', borderRadius: '4px', background: 'transparent', color: 'var(--color-primary)', fontWeight: 'bold' }}>
                    {isProcessing ? '...' : 'Visualiser'}
                  </button>
                  <button type="button" onClick={handleFinalValidation} disabled={isProcessing} style={{ padding: '0.75rem 1rem', border: 'none', borderRadius: '4px', background: 'var(--color-primary)', color: 'white', fontWeight: 'bold' }}>
                    Valider
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setScanMode('CROP')} style={{ padding: '0.75rem 1rem', border: '1px solid var(--color-primary)', borderRadius: '4px', background: 'transparent', color: 'var(--color-primary)', fontWeight: 'bold' }}>
                    Modifier
                  </button>
                  <button type="button" onClick={handleFinalValidation} disabled={isProcessing} style={{ padding: '0.75rem 1rem', border: 'none', borderRadius: '4px', background: 'var(--color-primary)', color: 'white', fontWeight: 'bold' }}>
                    {isProcessing ? '...' : 'Valider'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {clientMounted && draggingIdx !== null && createPortal(
        <div style={{
          position: 'fixed',
          left: Math.max(10, Math.min(window.innerWidth - 170, pointerPos.x - 80)),
          top: pointerPos.y - 200 < 0 ? pointerPos.y + 80 : pointerPos.y - 200,
          width: 160,
          height: 160,
          borderRadius: '50%',
          overflow: 'hidden',
          border: '3px solid white',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          zIndex: 10000,
          pointerEvents: 'none',
          backgroundColor: '#000'
        }}>
          <canvas ref={loupeCanvasRef} width={160} height={160} style={{ width: '100%', height: '100%' }} />
        </div>,
        document.body
      )}
    </div>
  );
}
