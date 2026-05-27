'use client';

import React, { useState } from 'react';
import { updateDossierStatus } from '@/app/actions/admin';
import Link from 'next/link';

export default function AdminDashboard({ initialDossiers }: { initialDossiers: any[] }) {
  const [dossiers, setDossiers] = useState(initialDossiers);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const handleStatusChange = async (id: string, newStatut: string) => {
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
      case 'EN_ATTENTE': return { bg: '#FEF3C7', color: '#D97706' }; // Warning/Yellow
      case 'EN_TRAITEMENT': return { bg: '#DBEAFE', color: '#2563EB' }; // Blue
      case 'OFFRE_ENVOYEE': return { bg: '#E0E7FF', color: '#4F46E5' }; // Indigo
      case 'VALIDE': return { bg: '#D1FAE5', color: '#059669' }; // Success/Green
      case 'REJETE': return { bg: '#FEE2E2', color: '#DC2626' }; // Error/Red
      default: return { bg: '#F3F4F6', color: '#4B5563' }; // Gray
    }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header Admin */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>Tableau de bord Admin</h1>
            <p style={{ color: '#64748B', margin: '0.5rem 0 0 0' }}>Gérez les demandes de devis et les dossiers clients.</p>
          </div>
          <Link href="/" className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
            Retour au site
          </Link>
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
          <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748B', margin: 0 }}>Total Dossiers</p>
            <h3 style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', margin: '0.5rem 0 0 0' }}>{dossiers.length}</h3>
          </div>
          <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#D97706', margin: 0 }}>En Attente</p>
            <h3 style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', margin: '0.5rem 0 0 0' }}>
              {dossiers.filter(d => d.statut === 'EN_ATTENTE').length}
            </h3>
          </div>
          <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#059669', margin: 0 }}>Validés</p>
            <h3 style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', margin: '0.5rem 0 0 0' }}>
              {dossiers.filter(d => d.statut === 'VALIDE').length}
            </h3>
          </div>
        </div>

        {/* Table */}
        <div style={{ backgroundColor: '#fff', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <tr>
                  <th style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>Dossier & Client</th>
                  <th style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>Véhicule</th>
                  <th style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>Date de création</th>
                  <th style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>Statut</th>
                  <th style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody style={{ divideY: '1px solid #E2E8F0' }}>
                {dossiers.map((dossier) => {
                  const statusColor = getStatusColor(dossier.statut);
                  return (
                    <tr key={dossier.id} style={{ borderBottom: '1px solid #E2E8F0', transition: 'background-color 0.2s' }} className="hover:bg-gray-50">
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <p style={{ fontWeight: 700, color: '#0F172A', margin: '0 0 0.25rem 0' }}>{dossier.numeroDossier}</p>
                        <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0 }}>{dossier.phone} {dossier.email && `• ${dossier.email}`}</p>
                      </td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <span style={{ fontSize: '0.875rem', color: '#334155', fontWeight: 500, textTransform: 'capitalize' }}>
                          {dossier.typeVehicule.toLowerCase().replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: '#64748B' }}>
                        {new Date(dossier.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <span style={{ 
                          backgroundColor: statusColor.bg, 
                          color: statusColor.color, 
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
                          {dossier.statut.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                        <select 
                          value={dossier.statut}
                          onChange={(e) => handleStatusChange(dossier.id, e.target.value)}
                          disabled={isUpdating === dossier.id}
                          style={{
                            padding: '0.5rem',
                            borderRadius: '0.375rem',
                            border: '1px solid #CBD5E1',
                            fontSize: '0.875rem',
                            outline: 'none',
                            cursor: isUpdating === dossier.id ? 'not-allowed' : 'pointer',
                            backgroundColor: isUpdating === dossier.id ? '#F1F5F9' : '#fff',
                            color: '#334155'
                          }}
                        >
                          <option value="EN_ATTENTE">En Attente</option>
                          <option value="EN_TRAITEMENT">En Traitement</option>
                          <option value="OFFRE_ENVOYEE">Offre Envoyée</option>
                          <option value="VALIDE">Validé</option>
                          <option value="REJETE">Rejeté</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}

                {dossiers.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                      Aucun dossier trouvé. Les nouvelles demandes apparaîtront ici.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
