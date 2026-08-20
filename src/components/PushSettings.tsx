'use client';

import { useState, useEffect } from 'react';

export default function PushSettings() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isIosPrompt, setIsIosPrompt] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsSupported(true);

      // Check if iOS (requires Add to Home Screen sometimes)
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      if (isIos && !isStandalone) {
        setIsIosPrompt(true);
      }

      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setIsSubscribed(!!sub);
          setIsLoading(false);
        });
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const subscribe = async () => {
    try {
      setIsLoading(true);
      const reg = await navigator.serviceWorker.ready;

      const res = await fetch('/api/webhooks/push/vapid-public-key');
      const { publicKey } = await res.json();

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey
      });

      await fetch('/api/webhooks/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub)
      });

      setIsSubscribed(true);
    } catch (err) {
      console.error('Failed to subscribe:', err);
      alert('Impossible de souscrire aux notifications.');
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async () => {
    try {
      setIsLoading(true);
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await fetch('/api/webhooks/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint })
        });
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error('Failed to unsubscribe:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const testPush = async () => {
    try {
      setIsLoading(true);
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/webhooks/push/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint })
        });
      }
    } catch (err) {
      console.error('Test push failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) {
    return <div>Les notifications push ne sont pas supportées par votre navigateur.</div>;
  }

  return (
    <div style={{ padding: '2rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>Notifications Push</h2>

      {isIosPrompt && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '8px' }}>
          Pour recevoir les notifications sur iPhone/iPad, ajoutez d’abord Business Action à l’écran d’accueil via le menu Partager.
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <span>Statut : <strong>{isSubscribed ? 'Activées' : 'Désactivées'}</strong></span>
        {isLoading && <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Chargement...</span>}
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        {!isSubscribed ? (
          <button
            onClick={subscribe}
            disabled={isLoading || isIosPrompt}
            style={{ padding: '0.75rem 1.5rem', backgroundColor: isIosPrompt ? '#d1d5db' : '#0ea5e9', color: 'white', border: 'none', borderRadius: '8px', cursor: isIosPrompt ? 'not-allowed' : 'pointer' }}
          >
            Activer les notifications
          </button>
        ) : (
          <>
            <button
              onClick={unsubscribe}
              disabled={isLoading}
              style={{ padding: '0.75rem 1.5rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
            >
              Désactiver
            </button>
            <button
              onClick={testPush}
              disabled={isLoading}
              style={{ padding: '0.75rem 1.5rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
            >
              Notification de test
            </button>
          </>
        )}
      </div>
    </div>
  );
}
