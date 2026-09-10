'use client';

import React, { useState, useEffect } from 'react';
import {
  getGeoRegions,
  getGeoDepartments,
  getGeoCommunes,
  getUserGeoLocation,
} from '@/app/actions/geo';

interface GeoSelectorProps {
  initialCommuneId?: string | null;
  name?: string;
  disabled?: boolean;
  onChange?: (communeId: string | null) => void;
}

interface GeoItem {
  id: string;
  name: string;
}

export function GeoSelector({
  initialCommuneId,
  name = 'geoCommuneId',
  disabled = false,
  onChange,
}: GeoSelectorProps) {
  const [regions, setRegions] = useState<GeoItem[]>([]);
  const [departments, setDepartments] = useState<GeoItem[]>([]);
  const [communes, setCommunes] = useState<GeoItem[]>([]);

  const [selectedRegionId, setSelectedRegionId] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedCommuneId, setSelectedCommuneId] = useState<string>('');

  const [isLoadingRegions, setIsLoadingRegions] = useState<boolean>(false);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState<boolean>(false);
  const [isLoadingCommunes, setIsLoadingCommunes] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);

  // 1. Initial load: charger les régions et restaurer la sélection existante
  useEffect(() => {
    let isMounted = true;

    async function loadInitial() {
      setIsLoadingRegions(true);
      setError(null);

      try {
        const regionsRes = await getGeoRegions();
        if (!isMounted) return;

        if (regionsRes.success && regionsRes.regions) {
          setRegions(regionsRes.regions);
        } else {
          setError(regionsRes.error || 'Erreur lors du chargement des régions.');
        }

        // Restauration de la sélection existante
        setIsRestoring(true);
        const locRes = await getUserGeoLocation();
        if (!isMounted) return;

        if (locRes.success && locRes.location) {
          const loc = locRes.location;
          setSelectedRegionId(loc.regionId);

          // Charger départements de la région
          setIsLoadingDepartments(true);
          const deptsRes = await getGeoDepartments(loc.regionId);
          if (deptsRes.success && deptsRes.departments) {
            setDepartments(deptsRes.departments);
            setSelectedDepartmentId(loc.departmentId);

            // Charger communes du département
            setIsLoadingCommunes(true);
            const commsRes = await getGeoCommunes(loc.departmentId);
            if (commsRes.success && commsRes.communes) {
              setCommunes(commsRes.communes);
              setSelectedCommuneId(loc.communeId);
              if (onChange) onChange(loc.communeId);
            }
          }
        } else if (initialCommuneId) {
          setSelectedCommuneId(initialCommuneId);
          if (onChange) onChange(initialCommuneId);
        }
      } catch (err) {
        if (isMounted) setError('Impossible de charger les données géographiques.');
      } finally {
        if (isMounted) {
          setIsLoadingRegions(false);
          setIsLoadingDepartments(false);
          setIsLoadingCommunes(false);
          setIsRestoring(false);
        }
      }
    }

    loadInitial();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Gestion du changement de Région
  const handleRegionChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRegionId = e.target.value;
    setSelectedRegionId(newRegionId);
    setSelectedDepartmentId('');
    setSelectedCommuneId('');
    setDepartments([]);
    setCommunes([]);
    setError(null);
    if (onChange) onChange(null);

    if (!newRegionId) return;

    setIsLoadingDepartments(true);
    try {
      const res = await getGeoDepartments(newRegionId);
      if (res.success && res.departments) {
        setDepartments(res.departments);
      } else {
        setError(res.error || 'Erreur chargement des départements.');
      }
    } catch (err) {
      setError('Erreur réseau lors du chargement des départements.');
    } finally {
      setIsLoadingDepartments(false);
    }
  };

  // 3. Gestion du changement de Département
  const handleDepartmentChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDeptId = e.target.value;
    setSelectedDepartmentId(newDeptId);
    setSelectedCommuneId('');
    setCommunes([]);
    setError(null);
    if (onChange) onChange(null);

    if (!newDeptId) return;

    setIsLoadingCommunes(true);
    try {
      const res = await getGeoCommunes(newDeptId);
      if (res.success && res.communes) {
        setCommunes(res.communes);
      } else {
        setError(res.error || 'Erreur chargement des communes.');
      }
    } catch (err) {
      setError('Erreur réseau lors du chargement des communes.');
    } finally {
      setIsLoadingCommunes(false);
    }
  };

  // 4. Gestion du changement de Commune
  const handleCommuneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCommuneId = e.target.value;
    setSelectedCommuneId(newCommuneId);
    if (onChange) onChange(newCommuneId || null);
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.875rem',
    borderRadius: '0.75rem',
    border: '1px solid #E2E8F0',
    backgroundColor: disabled ? '#F1F5F9' : '#fff',
    color: '#0F172A',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.35rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#475569',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Hidden input pour soumission standard dans FormData */}
      <input type="hidden" name={name} value={selectedCommuneId} />

      {error && (
        <div
          style={{
            fontSize: '0.85rem',
            color: '#DC2626',
            backgroundColor: '#FEF2F2',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid #FECACA',
          }}
        >
          {error}
        </div>
      )}

      {/* 1. Sélecteur Région */}
      <div>
        <label htmlFor="geo-region-select" style={labelStyle}>
          Région <span style={{ color: '#94A3B8', fontWeight: 400 }}>(Facultatif)</span>
        </label>
        <select
          id="geo-region-select"
          value={selectedRegionId}
          onChange={handleRegionChange}
          disabled={disabled || isLoadingRegions || isRestoring}
          style={selectStyle}
        >
          <option value="">
            {isLoadingRegions ? 'Chargement des régions...' : 'Sélectionner une région'}
          </option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {/* 2. Sélecteur Département */}
      <div>
        <label htmlFor="geo-dept-select" style={labelStyle}>
          Département
        </label>
        <select
          id="geo-dept-select"
          value={selectedDepartmentId}
          onChange={handleDepartmentChange}
          disabled={disabled || !selectedRegionId || isLoadingDepartments || isRestoring}
          style={{
            ...selectStyle,
            backgroundColor: !selectedRegionId || disabled ? '#F8FAFC' : '#fff',
            cursor: !selectedRegionId ? 'not-allowed' : 'default',
          }}
        >
          <option value="">
            {!selectedRegionId
              ? 'Sélectionnez d\'abord une région'
              : isLoadingDepartments
              ? 'Chargement des départements...'
              : 'Sélectionner un département'}
          </option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* 3. Sélecteur Commune */}
      <div>
        <label htmlFor="geo-commune-select" style={labelStyle}>
          Commune
        </label>
        <select
          id="geo-commune-select"
          value={selectedCommuneId}
          onChange={handleCommuneChange}
          disabled={disabled || !selectedDepartmentId || isLoadingCommunes || isRestoring}
          style={{
            ...selectStyle,
            backgroundColor: !selectedDepartmentId || disabled ? '#F8FAFC' : '#fff',
            cursor: !selectedDepartmentId ? 'not-allowed' : 'default',
          }}
        >
          <option value="">
            {!selectedDepartmentId
              ? 'Sélectionnez d\'abord un département'
              : isLoadingCommunes
              ? 'Chargement des communes...'
              : 'Sélectionner une commune'}
          </option>
          {communes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
