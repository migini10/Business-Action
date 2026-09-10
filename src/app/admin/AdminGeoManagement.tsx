'use client';

import React, { useState, useEffect } from 'react';
import {
  getAdminGeoOverview,
  createAdminGeoEntry,
  toggleAdminGeoActive,
  GeoEntityType,
} from '@/app/actions/admin-geo';

export default function AdminGeoManagement() {
  const [geoData, setGeoData] = useState<{
    countries: any[];
    regions: any[];
    departments: any[];
    communes: any[];
    communesTotal: number;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<'regions' | 'departments' | 'communes' | 'countries'>('regions');
  const [searchFilter, setSearchFilter] = useState('');

  // Formulaire de création
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<GeoEntityType>('commune');
  const [createName, setCreateName] = useState('');
  const [createCode, setCreateCode] = useState('');
  const [createParentId, setCreateParentId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getAdminGeoOverview();
      if (res.success && res.data) {
        setGeoData(res.data);
      } else {
        setError(res.error || 'Erreur lors du chargement des données géographiques.');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur de communication.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleActive = async (type: GeoEntityType, id: string, currentActive: boolean) => {
    try {
      const res = await toggleAdminGeoActive(type, id, !currentActive);
      if (res.success) {
        setSuccessMessage(`Statut mis à jour avec succès.`);
        setTimeout(() => setSuccessMessage(null), 3000);
        await loadData();
      } else {
        setError(res.error || 'Impossible de mettre à jour le statut.');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour.');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await createAdminGeoEntry(createType, {
        name: createName,
        code: createCode,
        parentId: createParentId,
      });

      if (res.success) {
        setSuccessMessage(`Entrée créée avec succès.`);
        setTimeout(() => setSuccessMessage(null), 3000);
        setShowCreateModal(false);
        setCreateName('');
        setCreateCode('');
        setCreateParentId('');
        await loadData();
      } else {
        setError(res.error || 'Impossible de créer l\'entrée.');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
        <p style={{ fontWeight: 600 }}>Chargement du référentiel géographique...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
            Référentiel Géographique (GEO Core)
          </h2>
          <p style={{ color: '#64748B', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
            Gestion administrative des pays, régions, départements et communes du Sénégal.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
          style={{ padding: '0.75rem 1.25rem', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          + Nouvelle Entrée
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '1rem', borderRadius: '0.75rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {successMessage && (
        <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', color: '#16A34A', padding: '1rem', borderRadius: '0.75rem', fontSize: '0.875rem' }}>
          {successMessage}
        </div>
      )}

      {/* Résumé Compteurs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
        <div
          onClick={() => setActiveSubTab('countries')}
          style={{
            padding: '1rem',
            backgroundColor: activeSubTab === 'countries' ? '#EEF2FF' : '#fff',
            border: `2px solid ${activeSubTab === 'countries' ? '#6366F1' : '#E2E8F0'}`,
            borderRadius: '0.75rem',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Pays</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', marginTop: '0.25rem' }}>
            {geoData?.countries.length || 0}
          </div>
        </div>

        <div
          onClick={() => setActiveSubTab('regions')}
          style={{
            padding: '1rem',
            backgroundColor: activeSubTab === 'regions' ? '#EEF2FF' : '#fff',
            border: `2px solid ${activeSubTab === 'regions' ? '#6366F1' : '#E2E8F0'}`,
            borderRadius: '0.75rem',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Régions</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', marginTop: '0.25rem' }}>
            {geoData?.regions.length || 0}
          </div>
        </div>

        <div
          onClick={() => setActiveSubTab('departments')}
          style={{
            padding: '1rem',
            backgroundColor: activeSubTab === 'departments' ? '#EEF2FF' : '#fff',
            border: `2px solid ${activeSubTab === 'departments' ? '#6366F1' : '#E2E8F0'}`,
            borderRadius: '0.75rem',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Départements</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', marginTop: '0.25rem' }}>
            {geoData?.departments.length || 0}
          </div>
        </div>

        <div
          onClick={() => setActiveSubTab('communes')}
          style={{
            padding: '1rem',
            backgroundColor: activeSubTab === 'communes' ? '#EEF2FF' : '#fff',
            border: `2px solid ${activeSubTab === 'communes' ? '#6366F1' : '#E2E8F0'}`,
            borderRadius: '0.75rem',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Communes</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', marginTop: '0.25rem' }}>
            {geoData?.communesTotal ?? 0}
          </div>
        </div>
      </div>

      {/* Barre de recherche */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Rechercher par nom..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid #CBD5E1',
            fontSize: '0.875rem',
            outline: 'none',
          }}
        />
      </div>

      {/* Tables de visualisation */}
      <div style={{ backgroundColor: '#fff', borderRadius: '0.75rem', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {activeSubTab === 'regions' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem', color: '#64748B' }}>Région</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748B' }}>Pays</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748B' }}>Départements</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748B' }}>Statut</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748B', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {geoData?.regions
                .filter((r) => r.name.toLowerCase().includes(searchFilter.toLowerCase()))
                .map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0F172A' }}>{r.name}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748B' }}>{r.country?.name || 'Sénégal'}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748B' }}>{r._count?.departments || 0}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '1rem',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: r.active ? '#DCFCE7' : '#F1F5F9',
                          color: r.active ? '#15803D' : '#64748B',
                        }}
                      >
                        {r.active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <button
                        onClick={() => handleToggleActive('region', r.id, r.active)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: r.active ? '#DC2626' : '#16A34A',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                        }}
                      >
                        {r.active ? 'Désactiver' : 'Activer'}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        {activeSubTab === 'departments' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem', color: '#64748B' }}>Département</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748B' }}>Région</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748B' }}>Communes</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748B' }}>Statut</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748B', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {geoData?.departments
                .filter((d) => d.name.toLowerCase().includes(searchFilter.toLowerCase()) || d.region?.name.toLowerCase().includes(searchFilter.toLowerCase()))
                .map((d) => (
                  <tr key={d.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0F172A' }}>{d.name}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748B' }}>{d.region?.name}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748B' }}>{d._count?.communes || 0}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '1rem',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: d.active ? '#DCFCE7' : '#F1F5F9',
                          color: d.active ? '#15803D' : '#64748B',
                        }}
                      >
                        {d.active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <button
                        onClick={() => handleToggleActive('department', d.id, d.active)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: d.active ? '#DC2626' : '#16A34A',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                        }}
                      >
                        {d.active ? 'Désactiver' : 'Activer'}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        {activeSubTab === 'communes' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem', color: '#64748B' }}>Commune</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748B' }}>Département</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748B' }}>Région</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748B' }}>Utilisateurs</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748B' }}>Statut</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748B', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {geoData?.communes
                .filter((c) => c.name.toLowerCase().includes(searchFilter.toLowerCase()) || c.department?.name.toLowerCase().includes(searchFilter.toLowerCase()))
                .map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0F172A' }}>{c.name}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748B' }}>{c.department?.name}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748B' }}>{c.department?.region?.name}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748B' }}>{c._count?.users || 0}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '1rem',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: c.active ? '#DCFCE7' : '#F1F5F9',
                          color: c.active ? '#15803D' : '#64748B',
                        }}
                      >
                        {c.active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <button
                        onClick={() => handleToggleActive('commune', c.id, c.active)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: c.active ? '#DC2626' : '#16A34A',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                        }}
                      >
                        {c.active ? 'Désactiver' : 'Activer'}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        {activeSubTab === 'countries' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem', color: '#64748B' }}>Code</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748B' }}>Pays</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748B' }}>Régions</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748B' }}>Statut</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748B', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {geoData?.countries
                .filter((ct) => ct.name.toLowerCase().includes(searchFilter.toLowerCase()) || ct.code.toLowerCase().includes(searchFilter.toLowerCase()))
                .map((ct) => (
                  <tr key={ct.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0F172A' }}>{ct.code}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0F172A' }}>{ct.name}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748B' }}>{ct._count?.regions || 0}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '1rem',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: ct.active ? '#DCFCE7' : '#F1F5F9',
                          color: ct.active ? '#15803D' : '#64748B',
                        }}
                      >
                        {ct.active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <button
                        onClick={() => handleToggleActive('country', ct.id, ct.active)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: ct.active ? '#DC2626' : '#16A34A',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                        }}
                      >
                        {ct.active ? 'Désactiver' : 'Activer'}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Création */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '1rem', padding: '2rem', maxWidth: '450px', width: '100%' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 1.5rem 0', color: '#0F172A' }}>
              Ajouter une entrée GEO
            </h3>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                  Type d'entité
                </label>
                <select
                  value={createType}
                  onChange={(e) => {
                    setCreateType(e.target.value as GeoEntityType);
                    setCreateParentId('');
                  }}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1' }}
                >
                  <option value="commune">Commune</option>
                  <option value="department">Département</option>
                  <option value="region">Région</option>
                  <option value="country">Pays</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                  Nom
                </label>
                <input
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Ex: Touba"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1' }}
                />
              </div>

              {createType === 'country' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                    Code pays (ISO-2)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    value={createCode}
                    onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
                    placeholder="SN"
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1' }}
                  />
                </div>
              )}

              {createType === 'region' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                    Pays parent
                  </label>
                  <select
                    required
                    value={createParentId}
                    onChange={(e) => setCreateParentId(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1' }}
                  >
                    <option value="">Sélectionner le pays</option>
                    {geoData?.countries.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                    ))}
                  </select>
                </div>
              )}

              {createType === 'department' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                    Région parente
                  </label>
                  <select
                    required
                    value={createParentId}
                    onChange={(e) => setCreateParentId(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1' }}
                  >
                    <option value="">Sélectionner la région</option>
                    {geoData?.regions.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {createType === 'commune' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                    Département parent
                  </label>
                  <select
                    required
                    value={createParentId}
                    onChange={(e) => setCreateParentId(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1' }}
                  >
                    <option value="">Sélectionner le département</option>
                    {geoData?.departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.region?.name})</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1', backgroundColor: '#fff', cursor: 'pointer' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem' }}
                >
                  {isSubmitting ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
