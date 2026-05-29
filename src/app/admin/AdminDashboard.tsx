'use client';

import React, { useState } from 'react';
import { updateDossierStatus, uploadAndSendDevis } from '@/app/actions/admin';
import Link from 'next/link';

export default function AdminDashboard({ initialDossiers }: { initialDossiers: any[] }) {
  const [dossiers, setDossiers] = useState(initialDossiers);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedDossier, setSelectedDossier] = useState<any | null>(null);
  
  const [devisFile, setDevisFile] = useState<File | null>(null);
  const [isUploadingDevis, setIsUploadingDevis] = useState(false);

  const handleDevisSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!devisFile || !selectedDossier) return;
    
    setIsUploadingDevis(true);
    const formData = new FormData();
    formData.append('dossierId', selectedDossier.id);
    formData.append('devis', devisFile);

    const result = await uploadAndSendDevis(formData);
    setIsUploadingDevis(false);
    
    if (result.success) {
      alert(result.message);
      setDevisFile(null);
      // Update local state to reflect the new status
      setDossiers(dossiers.map(d => d.id === selectedDossier.id ? { ...d, statut: 'OFFRE_ENVOYEE', devisUrl: result.devisUrl } : d));
      setSelectedDossier({ ...selectedDossier, statut: 'OFFRE_ENVOYEE', devisUrl: result.devisUrl });
    } else {
      alert(result.error || "Erreur lors de l'upload du devis.");
    }
  };

  const handleStatusChange = async (id: string, newStatut: string) => {
    const isConfirmed = window.confirm(`Êtes-vous sûr de vouloir changer le statut de ce dossier à "${newStatut.replace('_', ' ')}" ?`);
    if (!isConfirmed) return;

    setIsUpdating(id);
    const result = await updateDossierStatus(id, newStatut);
    if (result.success) {
      setDossiers(dossiers.map(d => d.id === id ? { ...d, statut: newStatut } : d));
    } else {
      alert("Erreur lors de la mise à jour");
    }
    setIsUpdating(null);
  };

  const getStatusColor = (statut: string) => {
    switch(statut) {
      case 'EN_ATTENTE': return { bg: '#FEF3C7', color: '#D97706', label: 'En Attente' };
      case 'EN_TRAITEMENT': return { bg: '#DBEAFE', color: '#2563EB', label: 'En Traitement' };
      case 'OFFRE_ENVOYEE': return { bg: '#E0E7FF', color: '#4F46E5', label: 'Offre Envoyée' };
      case 'VALIDE': return { bg: '#D1FAE5', color: '#059669', label: 'Validé' };
      case 'REJETE': return { bg: '#FEE2E2', color: '#DC2626', label: 'Rejeté' };
      default: return { bg: '#F3F4F6', color: '#4B5563', label: statut };
    }
  }

  // Stats calculation
  const totalDossiers = dossiers.length;
  const pendingDossiers = dossiers.filter(d => d.statut === 'EN_ATTENTE').length;
  const validatedDossiers = dossiers.filter(d => d.statut === 'VALIDE').length;
  const rejectedDossiers = dossiers.filter(d => d.statut === 'REJETE').length;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--color-gray-light)' }}>
      {/* Sidebar */}
      <aside style={{
        width: '260px',
        backgroundColor: '#ffffff',
        borderRight: '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        height: '100vh',
        zIndex: 40
      }}>
        <div style={{ padding: '2rem 1.5rem', borderBottom: '1px solid #E2E8F0' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            BizAction
          </h2>
        </div>

        <nav style={{ flex: 1, padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button onClick={() => setActiveTab('dashboard')} style={{ ...navItemStyle, ...(activeTab === 'dashboard' ? activeNavItemStyle : {}) }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            Tableau de bord
          </button>
          <button onClick={() => setActiveTab('demandes')} style={{ ...navItemStyle, ...(activeTab === 'demandes' ? activeNavItemStyle : {}) }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Demandes
          </button>
          <button onClick={() => setActiveTab('utilisateurs')} style={{ ...navItemStyle, ...(activeTab === 'utilisateurs' ? activeNavItemStyle : {}) }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            Utilisateurs
          </button>
          <button onClick={() => setActiveTab('parametres')} style={{ ...navItemStyle, ...(activeTab === 'parametres' ? activeNavItemStyle : {}) }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            Paramètres
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, marginLeft: '260px', display: 'flex', flexDirection: 'column' }}>
        {/* Topbar */}
        <header style={{ height: '70px', backgroundColor: '#ffffff', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem', position: 'sticky', top: 0, zIndex: 30 }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" placeholder="Rechercher un dossier..." style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', borderRadius: '999px', border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.875rem', backgroundColor: '#F8FAFC' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', color: '#64748B' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '10px', height: '10px', backgroundColor: '#EF4444', borderRadius: '50%', border: '2px solid #fff' }}></span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '1px solid #E2E8F0', paddingLeft: '1.5rem' }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#0F172A' }}>Admin</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748B' }}>admin@business-action.com</p>
              </div>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', fontWeight: 'bold' }}>
                A
              </div>
            </div>
            <Link href="/" title="Retour au site" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#FEE2E2', color: '#DC2626', transition: 'all 0.2s', marginLeft: '0.5rem' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </Link>
          </div>
        </header>

        {/* Content Area */}
        <div style={{ padding: '2rem', flex: 1 }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            
            <div style={{ marginBottom: '2rem' }}>
              <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.5rem 0' }}>Bonjour, Admin 👋</h1>
              <p style={{ color: '#64748B', margin: 0 }}>Voici un aperçu des activités de votre plateforme.</p>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
              <div style={{ ...kpiCardStyle, borderBottom: '4px solid var(--color-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748B', margin: 0 }}>Total Dossiers</p>
                    <h3 style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', margin: '0.5rem 0 0 0' }}>{totalDossiers}</h3>
                  </div>
                  <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-primary-light)', borderRadius: '0.75rem', color: 'var(--color-primary)' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                  </div>
                </div>
              </div>

              <div style={{ ...kpiCardStyle, borderBottom: '4px solid #F59E0B' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748B', margin: 0 }}>En Attente</p>
                    <h3 style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', margin: '0.5rem 0 0 0' }}>{pendingDossiers}</h3>
                  </div>
                  <div style={{ padding: '0.75rem', backgroundColor: '#FEF3C7', borderRadius: '0.75rem', color: '#D97706' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  </div>
                </div>
              </div>

              <div style={{ ...kpiCardStyle, borderBottom: '4px solid #10B981' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748B', margin: 0 }}>Validés</p>
                    <h3 style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', margin: '0.5rem 0 0 0' }}>{validatedDossiers}</h3>
                  </div>
                  <div style={{ padding: '0.75rem', backgroundColor: '#D1FAE5', borderRadius: '0.75rem', color: '#059669' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  </div>
                </div>
              </div>

              <div style={{ ...kpiCardStyle, borderBottom: '4px solid #EF4444' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748B', margin: 0 }}>Rejetés</p>
                    <h3 style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', margin: '0.5rem 0 0 0' }}>{rejectedDossiers}</h3>
                  </div>
                  <div style={{ padding: '0.75rem', backgroundColor: '#FEE2E2', borderRadius: '0.75rem', color: '#DC2626' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Dossiers Table Section */}
            <div style={{ backgroundColor: '#fff', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>Dossiers Récents</h3>
                <button style={{ padding: '0.5rem 1rem', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                  Filtrer
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <tr>
                      <th style={thStyle}>Client & Dossier</th>
                      <th style={thStyle}>Véhicule & Docs</th>
                      <th style={thStyle}>Date</th>
                      <th style={thStyle}>Statut</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dossiers.map((dossier) => {
                      const statusInfo = getStatusColor(dossier.statut);
                      return (
                        <tr key={dossier.id} style={{ borderBottom: '1px solid #E2E8F0', transition: 'background-color 0.2s' }} className="hover:bg-gray-50">
                          <td style={tdStyle}>
                            <p style={{ fontWeight: 700, color: '#0F172A', margin: '0 0 0.25rem 0' }}>{dossier.numeroDossier}</p>
                            <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                              {dossier.phone}
                            </p>
                            {dossier.email && (
                               <p style={{ fontSize: '0.875rem', color: '#64748B', margin: '0.25rem 0 0 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                 {dossier.email}
                               </p>
                            )}
                          </td>
                          <td style={tdStyle}>
                            <span style={{ fontSize: '0.875rem', color: '#334155', fontWeight: 600, textTransform: 'capitalize', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', backgroundColor: '#F1F5F9', padding: '0.25rem 0.75rem', borderRadius: '999px' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                              {dossier.typeVehicule.toLowerCase().replace('_', ' ')}
                            </span>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              {dossier.rectoUrl && <a href={dossier.rectoUrl} target="_blank" rel="noreferrer" style={docLinkStyle}>📄 Carte Grise (Recto)</a>}
                              {dossier.versoUrl && <a href={dossier.versoUrl} target="_blank" rel="noreferrer" style={docLinkStyle}>📄 Carte Grise (Verso)</a>}
                            </div>
                          </td>
                          <td style={{ ...tdStyle, color: '#64748B' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                              {new Date(dossier.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                          </td>
                          <td style={tdStyle}>
                            <span style={{ 
                              backgroundColor: statusInfo.bg, 
                              color: statusInfo.color, 
                              padding: '0.375rem 0.75rem', 
                              borderRadius: '9999px', 
                              fontSize: '0.75rem', 
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.375rem'
                            }}>
                              {isUpdating === dossier.id && (
                                <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
                              )}
                              {statusInfo.label}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                              <button 
                                onClick={() => setSelectedDossier(dossier)}
                                style={{ padding: '0.5rem', backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '0.5rem', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                title="Voir détails"
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                              </button>
                              <select 
                                value={dossier.statut}
                                onChange={(e) => handleStatusChange(dossier.id, e.target.value)}
                                disabled={isUpdating === dossier.id}
                                style={{
                                  padding: '0.5rem 2rem 0.5rem 0.75rem',
                                  borderRadius: '0.5rem',
                                  border: '1px solid #CBD5E1',
                                  fontSize: '0.875rem',
                                  fontWeight: 600,
                                  outline: 'none',
                                  cursor: isUpdating === dossier.id ? 'not-allowed' : 'pointer',
                                  backgroundColor: isUpdating === dossier.id ? '#F1F5F9' : '#fff',
                                  color: '#334155',
                                  appearance: 'none',
                                  backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23475569%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
                                  backgroundRepeat: 'no-repeat',
                                  backgroundPosition: 'right 0.7rem top 50%',
                                  backgroundSize: '0.65rem auto',
                                }}
                              >
                                <option value="EN_ATTENTE">Mettre en attente</option>
                                <option value="EN_TRAITEMENT">Traiter</option>
                                <option value="OFFRE_ENVOYEE">Offre Envoyée</option>
                                <option value="VALIDE">Valider</option>
                                <option value="REJETE">Rejeter</option>
                              </select>
                            </div>
                          </td>
                        </tr>
                      )
                    })}

                    {dossiers.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: '4rem', textAlign: 'center', color: '#64748B' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                            <p style={{ margin: 0, fontSize: '1.125rem', fontWeight: 500 }}>Aucun dossier trouvé.</p>
                            <p style={{ margin: 0, fontSize: '0.875rem' }}>Les nouvelles demandes apparaîtront ici.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>

        {/* Modal Détails Dossier */}
        {selectedDossier && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setSelectedDossier(null)}>
            <div style={{ backgroundColor: '#fff', borderRadius: '1.5rem', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', position: 'relative' }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: '2rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(8px)', zIndex: 10 }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem 0' }}>Détails du Dossier</h2>
                  <p style={{ margin: 0, color: '#64748B', fontSize: '0.875rem' }}>{selectedDossier.numeroDossier}</p>
                </div>
                <button onClick={() => setSelectedDossier(null)} style={{ background: '#F1F5F9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              
              <div style={{ padding: '2rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
                  
                  {/* Informations Client */}
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                      Contact Client
                    </h3>
                    <div style={{ backgroundColor: '#F8FAFC', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #E2E8F0' }}>
                      <p style={{ margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem' }}>
                        <span style={{ color: '#64748B' }}>Tél :</span>
                        <strong style={{ color: '#0F172A' }}>{selectedDossier.phone}</strong>
                      </p>
                      <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem' }}>
                        <span style={{ color: '#64748B' }}>Email :</span>
                        <strong style={{ color: '#0F172A', wordBreak: 'break-all' }}>{selectedDossier.email || 'Non renseigné'}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Informations Véhicule */}
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                      Véhicule
                    </h3>
                    <div style={{ backgroundColor: '#F8FAFC', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #E2E8F0' }}>
                      <p style={{ margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem' }}>
                        <span style={{ color: '#64748B' }}>Type :</span>
                        <span style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700 }}>
                          {selectedDossier.typeVehicule.replace('_', ' ')}
                        </span>
                      </p>
                      <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem' }}>
                        <span style={{ color: '#64748B' }}>Date :</span>
                        <strong style={{ color: '#0F172A' }}>{new Date(selectedDossier.createdAt).toLocaleDateString('fr-FR')}</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Documents */}
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  Documents Justificatifs
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  {(() => {
                    const renderFilePreview = (url: string, label: string) => {
                      if (!url) {
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', backgroundColor: '#F1F5F9', border: '2px dashed #E2E8F0', borderRadius: '1rem', color: '#94A3B8' }}>
                            Aucun {label.toLowerCase()} fourni
                          </div>
                        );
                      }
                      const isPdfDocument = url.toLowerCase().includes('.pdf');
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>{label}</span>
                          <a href={url} target="_blank" rel="noreferrer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '1rem', overflow: 'hidden', border: '1px solid #E2E8F0', height: '200px', backgroundColor: '#F8FAFC', position: 'relative', textDecoration: 'none', color: '#0F172A' }}>
                            {isPdfDocument ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                <span style={{ fontWeight: 600 }}>Ouvrir le PDF</span>
                              </div>
                            ) : (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt={`Carte Grise ${label}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.3)'; e.currentTarget.style.opacity = '1'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0)'; e.currentTarget.style.opacity = '0'; }}>
                                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                </div>
                              </>
                            )}
                          </a>
                        </div>
                      );
                    };

                    return (
                      <>
                        {renderFilePreview(selectedDossier.rectoUrl, 'Recto')}
                        {renderFilePreview(selectedDossier.versoUrl, 'Verso')}
                      </>
                    );
                  })()}
                </div>

                {/* Devis Upload Section */}
                <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #E2E8F0' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2"><path d="M22 2L11 13"></path><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    Envoyer une Offre (Devis)
                  </h3>
                  
                  {selectedDossier.devisUrl ? (
                    <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', padding: '1.5rem', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ backgroundColor: '#22C55E', color: 'white', padding: '0.5rem', borderRadius: '50%' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                        <div>
                          <p style={{ fontWeight: 700, color: '#166534', margin: 0 }}>Devis envoyé au client</p>
                          <p style={{ fontSize: '0.875rem', color: '#15803D', margin: 0 }}>Statut mis à jour automatiquement en "Offre Envoyée"</p>
                        </div>
                      </div>
                      <a href={selectedDossier.devisUrl === 'uploaded' ? '#' : selectedDossier.devisUrl} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', backgroundColor: 'white', color: '#166534', border: '1px solid #BBF7D0' }}>
                        Voir le devis
                      </a>
                    </div>
                  ) : (
                    <form onSubmit={handleDevisSubmit} style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '1.5rem', borderRadius: '1rem' }}>
                      <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1rem' }}>
                        Uploadez le PDF du devis. Le client recevra automatiquement un Email et un message WhatsApp avec le lien pour le consulter.
                      </p>
                      
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', border: '2px dashed #CBD5E1', borderRadius: '0.75rem', padding: '1rem', textAlign: 'center', cursor: 'pointer', backgroundColor: devisFile ? '#EFF6FF' : 'white', borderColor: devisFile ? 'var(--color-primary)' : '#CBD5E1', transition: 'all 0.2s' }}>
                            <input 
                              type="file" 
                              accept=".pdf,.png,.jpg,.jpeg" 
                              style={{ display: 'none' }} 
                              onChange={(e) => setDevisFile(e.target.files?.[0] || null)}
                              required
                            />
                            {devisFile ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                {devisFile.name}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#64748B' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                Choisir un fichier PDF
                              </div>
                            )}
                          </label>
                        </div>
                        <button 
                          type="submit" 
                          disabled={!devisFile || isUploadingDevis}
                          className="btn btn-primary"
                          style={{ padding: '1rem 1.5rem', whiteSpace: 'nowrap', opacity: (!devisFile || isUploadingDevis) ? 0.6 : 1, cursor: (!devisFile || isUploadingDevis) ? 'not-allowed' : 'pointer', border: 'none', borderRadius: '0.75rem', backgroundColor: 'var(--color-primary)', color: 'white', fontWeight: 600 }}
                        >
                          {isUploadingDevis ? 'Envoi en cours...' : 'Envoyer au client'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

const navItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.875rem 1rem',
  borderRadius: '0.75rem',
  fontSize: '0.95rem',
  fontWeight: 600,
  color: '#475569',
  cursor: 'pointer',
  border: 'none',
  background: 'none',
  width: '100%',
  textAlign: 'left' as const,
  transition: 'all 0.2s',
};

const activeNavItemStyle = {
  backgroundColor: 'var(--color-primary-light)',
  color: 'var(--color-primary)',
};

const kpiCardStyle = {
  backgroundColor: '#fff',
  padding: '1.5rem',
  borderRadius: '1rem',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
  border: '1px solid #E2E8F0'
};

const thStyle = {
  padding: '1.25rem 1.5rem',
  fontSize: '0.75rem',
  fontWeight: 700,
  color: '#64748B',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em'
};

const tdStyle = {
  padding: '1.5rem',
  minWidth: '150px'
};

const docLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0.375rem 0.75rem',
  backgroundColor: '#F8FAFC',
  border: '1px solid #E2E8F0',
  borderRadius: '0.5rem',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--color-primary)',
  textDecoration: 'none',
  transition: 'background-color 0.2s'
};
