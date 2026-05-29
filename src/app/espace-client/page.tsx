'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { loginClient, registerClient } from '@/app/actions/auth';
import { getClientDashboardData, respondToTransactionModification } from '@/app/actions/client';

export default function EspaceClient() {
  const [isLogin, setIsLogin] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'finances'>('dashboard');
  const [visibleCount, setVisibleCount] = useState(15);
  const [errorMessage, setErrorMessage] = useState('');

  const [financesData, setFinancesData] = useState<any[]>([]);
  const [dossiers, setDossiers] = useState<any[]>([]);
  const [clientData, setClientData] = useState<any>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const auth = localStorage.getItem('client_is_logged_in');
      const dataStr = localStorage.getItem('client_data');
      if (auth === 'true' && dataStr) {
        setIsLoggedIn(true);
        const data = JSON.parse(dataStr);
        setClientData(data);
        
        getClientDashboardData(data.id).then(res => {
          if (res.success) {
            setDossiers(res.dossiers || []);
            setFinancesData(res.transactions || []);
          } else {
            setIsLoggedIn(false);
            localStorage.removeItem('client_is_logged_in');
            localStorage.removeItem('client_data');
          }
        });
      }
    }
  }, []);

  const totalDettes = Math.abs(financesData.filter(d => d.montant < 0).reduce((sum, item) => sum + item.montant, 0));
  const totalCreances = financesData.filter(d => d.montant > 0).reduce((sum, item) => sum + item.montant, 0);
  const soldeActuel = financesData.reduce((sum, item) => sum + item.montant, 0);

  const currentItems = financesData.slice(0, visibleCount);

  const handleModificationResponse = async (transactionId: string, accept: boolean) => {
    setIsSubmitting(true);
    const res = await respondToTransactionModification(transactionId, accept);
    if (res.success) {
      alert(res.message);
      // Refresh
      if (clientData) {
        const dashRes = await getClientDashboardData(clientData.id);
        if (dashRes.success) {
          setFinancesData(dashRes.transactions || []);
        }
      }
    } else {
      alert(res.error);
    }
    setIsSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const result = isLogin 
      ? await loginClient(formData)
      : await registerClient(formData);

    setIsSubmitting(false);

    if (result.success && result.user) {
      setIsLoggedIn(true);
      setClientData(result.user);
      if (typeof window !== 'undefined') {
        localStorage.setItem('client_is_logged_in', 'true');
        localStorage.setItem('client_data', JSON.stringify(result.user));
      }
      
      const dashRes = await getClientDashboardData(result.user.id);
      if (dashRes.success) {
        setDossiers(dashRes.dossiers || []);
        setFinancesData(dashRes.transactions || []);
      }
    } else {
      setErrorMessage(result.error || 'Une erreur est survenue.');
    }
  };

  if (isLoggedIn) {
    return (
      <main className="animate-fade-in" style={{ minHeight: '80vh', padding: '4rem 2rem' }}>
        <div className="container" style={{ maxWidth: '1000px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>Tableau de Bord</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button onClick={() => setActiveTab('finances')} className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#10B981', borderColor: '#10B981' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                Créances et Dettes
              </button>
              <button onClick={() => { setIsLoggedIn(false); if (typeof window !== 'undefined') localStorage.removeItem('client_is_logged_in'); }} className="btn btn-secondary" style={{ padding: '0.75rem 1.5rem', fontSize: '0.875rem' }}>Déconnexion</button>
            </div>
          </div>
          {activeTab === 'finances' ? (
            <div className="card animate-fade-in" style={{ padding: '2rem', borderRadius: 'var(--radius-xl)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button onClick={() => setActiveTab('dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    Retour
                  </button>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>Historique des Créances et Dettes</h2>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', padding: '1.5rem', borderRadius: '1rem' }}>
                  <p style={{ color: '#166534', fontSize: '0.875rem', fontWeight: 600, margin: '0 0 0.5rem 0', textTransform: 'uppercase' }}>Total des Créances (À recevoir)</p>
                  <p style={{ color: '#15803D', fontSize: '2rem', fontWeight: 800, margin: 0 }}>{totalCreances.toLocaleString('fr-FR')} FCFA</p>
                </div>
                <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', padding: '1.5rem', borderRadius: '1rem' }}>
                  <p style={{ color: '#991B1B', fontSize: '0.875rem', fontWeight: 600, margin: '0 0 0.5rem 0', textTransform: 'uppercase' }}>Total des Dettes (À payer)</p>
                  <p style={{ color: '#B91C1C', fontSize: '2rem', fontWeight: 800, margin: 0 }}>{totalDettes.toLocaleString('fr-FR')} FCFA</p>
                </div>
              </div>

              <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
                <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-gray-light)' }}>
                      <th style={{ padding: '1rem', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.875rem' }}>Date</th>
                      <th style={{ padding: '1rem', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.875rem' }}>Description</th>
                      <th style={{ padding: '1rem', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.875rem' }}>Type</th>
                      <th style={{ padding: '1rem', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.875rem' }}>Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems.map((item) => (
                      <React.Fragment key={item.id}>
                        <tr style={{ borderBottom: item.isModificationPending ? 'none' : '1px solid var(--color-gray-light)' }}>
                          <td style={{ padding: '1rem', color: 'var(--color-text-main)', fontSize: '0.95rem' }}>{new Date(item.date).toLocaleDateString('fr-FR')}</td>
                          <td style={{ padding: '1rem', color: 'var(--color-text-main)', fontSize: '0.95rem' }}>
                            <div style={{ fontWeight: 600 }}>{item.description}</div>
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <span style={{ 
                              padding: '0.25rem 0.75rem', 
                              borderRadius: '2rem', 
                              fontSize: '0.75rem', 
                              fontWeight: 700, 
                              backgroundColor: item.type === 'DETTE' ? '#FEF2F2' : '#F0FDF4', 
                              color: item.type === 'DETTE' ? '#DC2626' : '#16A34A', 
                              textTransform: 'uppercase' 
                            }}>
                              {item.type}
                            </span>
                          </td>
                          <td style={{ padding: '1rem', color: item.type === 'DETTE' ? '#DC2626' : '#16A34A', fontSize: '0.95rem', fontWeight: 700 }}>
                            {item.montant > 0 ? '+' : ''}{item.montant.toLocaleString('fr-FR')} FCFA
                          </td>
                        </tr>
                        {item.isModificationPending && item.pendingModification && (
                          <tr style={{ borderBottom: '1px solid var(--color-gray-light)', backgroundColor: '#FFFBEB' }}>
                            <td colSpan={4} style={{ padding: '1rem', fontSize: '0.875rem', color: '#D97706' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                                <div>
                                  <strong>⚠️ Modification proposée par l'Admin :</strong><br />
                                  Nouveau montant : {item.pendingModification.montant > 0 ? '+' : ''}{item.pendingModification.montant.toLocaleString('fr-FR')} FCFA<br />
                                  Description : {item.pendingModification.description}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button onClick={() => handleModificationResponse(item.id, true)} disabled={isSubmitting} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', backgroundColor: '#10B981', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Accepter</button>
                                  <button onClick={() => handleModificationResponse(item.id, false)} disabled={isSubmitting} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', backgroundColor: '#EF4444', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Refuser</button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {visibleCount < financesData.length && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem', marginBottom: '1.5rem' }}>
                  <button 
                    onClick={() => setVisibleCount(prev => prev + 15)}
                    className="btn btn-secondary"
                    style={{ padding: '0.75rem 2rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB' }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    Voir les transactions plus anciennes
                  </button>
                </div>
              )}

              <div style={{ backgroundColor: soldeActuel >= 0 ? '#F0FDF4' : '#FEF2F2', border: `2px solid ${soldeActuel >= 0 ? '#22C55E' : '#EF4444'}`, padding: '1.5rem', borderRadius: '1rem', marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <p style={{ color: soldeActuel >= 0 ? '#166534' : '#991B1B', fontSize: '0.875rem', fontWeight: 600, margin: '0 0 0.5rem 0', textTransform: 'uppercase' }}>Solde Actuel</p>
                  <p style={{ color: soldeActuel >= 0 ? '#15803D' : '#B91C1C', fontSize: '2.5rem', fontWeight: 900, margin: 0 }}>
                    {soldeActuel >= 0 ? '+' : ''}{soldeActuel.toLocaleString('fr-FR')} FCFA
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ padding: '0.5rem 1rem', borderRadius: '2rem', fontSize: '0.875rem', fontWeight: 700, backgroundColor: soldeActuel >= 0 ? '#DCFCE7' : '#FEE2E2', color: soldeActuel >= 0 ? '#16A34A' : '#DC2626' }}>
                    {soldeActuel > 0 ? "L'entreprise vous doit de l'argent" : soldeActuel < 0 ? "Vous devez de l'argent" : "Solde équilibré"}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
            <div className="card" style={{ padding: '2rem', borderLeft: '4px solid var(--color-primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', borderRadius: '0.5rem' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                </div>
                <h3 style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textTransform: 'uppercase', margin: 0 }}>Dossiers en cours</h3>
              </div>
              <p style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>{dossiers.length}</p>
            </div>

            <div className="card" style={{ padding: '2rem', borderLeft: '4px solid var(--color-warning)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)', borderRadius: '0.5rem' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                </div>
                <h3 style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textTransform: 'uppercase', margin: 0 }}>Transactions</h3>
              </div>
              <p style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>{financesData.length}</p>
            </div>

            <div className="card" style={{ padding: '2rem', borderLeft: '4px solid var(--color-success)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', borderRadius: '0.5rem' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                </div>
                <h3 style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textTransform: 'uppercase', margin: 0 }}>Solde Actuel</h3>
              </div>
              <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>{soldeActuel.toLocaleString('fr-FR')} FCFA</p>
            </div>
          </div>

          <div className="card" style={{ padding: '2rem', borderRadius: 'var(--radius-xl)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '2rem', color: 'var(--color-text-main)' }}>Mes Dernières Demandes</h2>
            
            {dossiers.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)' }}>Aucune demande pour le moment.</p>
            ) : (
              dossiers.map(dossier => (
                <div key={dossier.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', border: '1px solid var(--color-gray)', borderRadius: 'var(--radius-lg)', marginBottom: '1rem', backgroundColor: 'var(--color-gray-light)' }}>
                  <div>
                    <p style={{ fontWeight: 800, color: 'var(--color-text-main)', margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>{dossier.numeroDossier}</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>Demande de devis • {dossier.typeVehicule.replace('_', ' ')}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ padding: '0.5rem 1rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)', borderRadius: '2rem', fontWeight: 600, fontSize: '0.875rem' }}>{dossier.statut}</span>
                    {dossier.devisUrl && (
                      <a href={dossier.devisUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none' }}>Voir Devis &rarr;</a>
                    )}
                  </div>
                </div>
              ))
            )}

          </div>
            </>
          )}
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '80vh', display: 'flex', justifyContent: 'center', padding: '4rem 1rem 2rem 1rem' }}>
      <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '450px', padding: '2.5rem 1.5rem', borderRadius: 'var(--radius-xl)', backgroundColor: '#fff', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ width: '64px', height: '64px', backgroundColor: 'var(--color-primary-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', color: 'var(--color-primary)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text-main)', margin: '0 0 0.5rem 0' }}>Espace Client</h1>
          <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>
            {isLogin ? 'Connectez-vous à votre compte' : 'Créez votre compte client'}
          </p>
        </div>

        {errorMessage && (
          <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '1rem', borderRadius: 'var(--radius-lg)', marginBottom: '1.5rem', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Nom Complet</label>
              <input 
                type="text" 
                name="name"
                required
                placeholder="Ex: Amadou Diallo" 
                style={{ width: '100%', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray)', fontSize: '1rem', outline: 'none', backgroundColor: 'var(--color-gray-light)', transition: 'border-color 0.2s' }} 
              />
            </div>
          )}

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Numéro de Téléphone (WhatsApp)</label>
            <input 
              type="tel" 
              name="phone"
              required
              placeholder="Ex: +221 77 123 45 67" 
              style={{ width: '100%', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray)', fontSize: '1rem', outline: 'none', backgroundColor: 'var(--color-gray-light)', transition: 'border-color 0.2s' }} 
            />
          </div>

          <div style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-main)', margin: 0 }}>Mot de Passe</label>
              {isLogin && (
                <a href="#" style={{ fontSize: '0.75rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>Oublié ?</a>
              )}
            </div>
            <input 
              type="password" 
              name="password"
              required
              placeholder="••••••••" 
              style={{ width: '100%', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray)', fontSize: '1rem', outline: 'none', backgroundColor: 'var(--color-gray-light)', transition: 'border-color 0.2s' }} 
            />
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
                Connexion...
              </>
            ) : (
              isLogin ? 'Se connecter' : 'Créer mon compte'
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: 0 }}>
            {isLogin ? "Vous n'avez pas de compte ?" : "Vous avez déjà un compte ?"}
            <br />
            <button 
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer', marginTop: '0.5rem', fontSize: '0.875rem', transition: 'color 0.2s' }}
            >
              {isLogin ? "Créer un compte maintenant" : "Se connecter"}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
