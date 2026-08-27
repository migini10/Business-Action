'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestPasswordReset, verifyOTP, updatePassword } from '../actions/reset-password';
import Link from 'next/link';

export default function MotDePasseOublie() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    const res: any = await requestPasswordReset(phone);
    if (res.success) {
      setSuccessMsg(res.message || null);
      setStep(2);
    } else {
      setError(res.error || 'Une erreur est survenue.');
    }
    setIsLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    const res: any = await verifyOTP(phone, otp);
    if (res.success) {
      setStep(3);
    } else {
      setError(res.error || 'Code incorrect.');
    }
    setIsLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    const res: any = await updatePassword(password);
    if (res.success) {
      setSuccessMsg('Votre mot de passe a été modifié avec succès. Vous pouvez maintenant vous connecter.');
      setTimeout(() => {
        router.push('/espace-client');
      }, 3000);
    } else {
      setError(res.error || 'Une erreur est survenue lors de la réinitialisation.');
    }
    setIsLoading(false);
  };

  return (
    <main style={{ minHeight: '80vh', display: 'flex', justifyContent: 'center', padding: '4rem 1rem 2rem 1rem' }}>
      <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '450px', padding: '2.5rem 1.5rem', borderRadius: 'var(--radius-xl)', backgroundColor: '#fff', margin: '0 auto', boxShadow: 'var(--shadow-lg)' }}>

        {/* En-tête */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: '64px', height: '64px', backgroundColor: 'var(--color-primary-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', color: 'var(--color-primary)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text-main)', margin: '0 0 0.5rem 0' }}>Mot de passe oublié</h1>
          <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '0.95rem' }}>
            {step === 1 && "Entrez votre numéro pour recevoir un code"}
            {step === 2 && "Saisissez le code à 6 chiffres reçu"}
            {step === 3 && "Définissez votre nouveau mot de passe"}
          </p>
        </div>

        {/* Progression textuelle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', fontSize: '0.75rem', fontWeight: 600 }}>
          <div style={{ color: step >= 1 ? 'var(--color-primary)' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ backgroundColor: step >= 1 ? 'var(--color-primary)' : '#E2E8F0', color: step >= 1 ? '#fff' : 'var(--color-text-muted)', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
            <span className="hidden sm:inline">Téléphone</span>
          </div>
          <div style={{ flex: 1, height: '2px', backgroundColor: step >= 2 ? 'var(--color-primary)' : '#E2E8F0', margin: '0 0.5rem' }}></div>
          <div style={{ color: step >= 2 ? 'var(--color-primary)' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ backgroundColor: step >= 2 ? 'var(--color-primary)' : '#E2E8F0', color: step >= 2 ? '#fff' : 'var(--color-text-muted)', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
            <span className="hidden sm:inline">Vérification</span>
          </div>
          <div style={{ flex: 1, height: '2px', backgroundColor: step >= 3 ? 'var(--color-primary)' : '#E2E8F0', margin: '0 0.5rem' }}></div>
          <div style={{ color: step >= 3 ? 'var(--color-primary)' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ backgroundColor: step >= 3 ? 'var(--color-primary)' : '#E2E8F0', color: step >= 3 ? '#fff' : 'var(--color-text-muted)', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
            <span className="hidden sm:inline">Mot de passe</span>
          </div>
        </div>

        {/* Erreur Globale */}
        {error && (
          <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '1rem', borderRadius: 'var(--radius-lg)', marginBottom: '1.5rem', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            {error}
          </div>
        )}

        {/* Message de succès général */}
        {successMsg && step !== 2 && (
          <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534', padding: '1rem', borderRadius: 'var(--radius-lg)', marginBottom: '1.5rem', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            {successMsg}
          </div>
        )}

        {/* Message de succès OTP (Étape 2) */}
        {step === 2 && (
          <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534', padding: '1.25rem', borderRadius: 'var(--radius-lg)', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Code de vérification envoyé</h3>
            </div>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', lineHeight: 1.5 }}>
              Si un compte correspondant existe, nous avons envoyé un code à 6 chiffres à l’adresse email associée à ce compte.
            </p>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', lineHeight: 1.5 }}>
              Vérifiez votre boîte de réception et vos courriers indésirables.
            </p>
            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700 }}>
              Ce code expire dans 15 minutes.
            </p>
          </div>
        )}

        {/* Etape 1 */}
        {step === 1 && (
          <form onSubmit={handleRequestReset}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Numéro de téléphone (WhatsApp)</label>
              <input
                type="tel"
                required
                placeholder="Ex: 221770000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ width: '100%', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray)', fontSize: '1rem', outline: 'none', backgroundColor: 'var(--color-gray-light)', transition: 'border-color 0.2s' }}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary"
              style={{ width: '100%', padding: '1rem', fontSize: '1rem', borderRadius: 'var(--radius-lg)', opacity: isLoading ? 0.7 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
            >
              {isLoading ? 'Envoi en cours...' : 'Recevoir le code'}
            </button>
          </form>
        )}

        {/* Etape 2 */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Code de vérification</label>
              <input
                type="text"
                required
                maxLength={6}
                pattern="\d{6}"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                style={{ width: '100%', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray)', fontSize: '1.5rem', outline: 'none', backgroundColor: 'var(--color-gray-light)', transition: 'border-color 0.2s', textAlign: 'center', letterSpacing: '0.5em', fontWeight: 700 }}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || otp.length !== 6}
              className="btn-primary"
              style={{ width: '100%', padding: '1rem', fontSize: '1rem', borderRadius: 'var(--radius-lg)', opacity: (isLoading || otp.length !== 6) ? 0.7 : 1, cursor: (isLoading || otp.length !== 6) ? 'not-allowed' : 'pointer', marginBottom: '1rem' }}
            >
              {isLoading ? 'Vérification...' : 'Vérifier le code'}
            </button>
            <div style={{ textAlign: 'center' }}>
              <button type="button" onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
                Modifier le numéro
              </button>
            </div>
          </form>
        )}

        {/* Etape 3 */}
        {step === 3 && (
          <form onSubmit={handleUpdatePassword}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Nouveau mot de passe</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray)', fontSize: '1rem', outline: 'none', backgroundColor: 'var(--color-gray-light)', transition: 'border-color 0.2s' }}
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Confirmer le mot de passe</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ width: '100%', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray)', fontSize: '1rem', outline: 'none', backgroundColor: 'var(--color-gray-light)', transition: 'border-color 0.2s' }}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary"
              style={{ width: '100%', padding: '1rem', fontSize: '1rem', borderRadius: 'var(--radius-lg)', opacity: isLoading ? 0.7 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
            >
              {isLoading ? 'Enregistrement...' : 'Modifier mon mot de passe'}
            </button>
          </form>
        )}

        {/* Footer Link */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link href="/espace-client" style={{ color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600 }}>
            ← Retour à la connexion
          </Link>
        </div>

      </div>
    </main>
  );
}
