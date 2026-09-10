'use server';

import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export type GeoEntityType = 'country' | 'region' | 'department' | 'commune';

export interface AdminGeoDeps {
  db: any;
  requireSuperAdmin: (roleOverride?: string) => Promise<any>;
}

export async function defaultRequireSuperAdmin(roleOverride?: string) {
  if (roleOverride !== undefined) {
    if (roleOverride !== 'SUPER_ADMIN') {
      throw new Error('Accès refusé : Action réservée au rôle SUPER_ADMIN.');
    }
    return { role: 'SUPER_ADMIN' };
  }
  // Session admin standard du backoffice (authentifiée via cookie admin_session)
  const session = await requireAdmin();
  return session;
}

// --- Consultations ---

export async function _getAdminGeoOverview(deps: AdminGeoDeps, roleOverride?: string) {
  try {
    await deps.requireSuperAdmin(roleOverride);

    const [countries, regions, departments, communes, communesTotal] = await Promise.all([
      deps.db.geoCountry.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { regions: true } } },
      }),
      deps.db.geoRegion.findMany({
        orderBy: { name: 'asc' },
        include: {
          country: { select: { id: true, code: true, name: true } },
          _count: { select: { departments: true } },
        },
      }),
      deps.db.geoDepartment.findMany({
        orderBy: { name: 'asc' },
        include: {
          region: { select: { id: true, name: true } },
          _count: { select: { communes: true } },
        },
      }),
      deps.db.geoCommune.findMany({
        take: 100, // Limite d'affichage pour le tableau détaillé, pas le total (cf. communesTotal)
        orderBy: { name: 'asc' },
        include: {
          department: {
            select: {
              id: true,
              name: true,
              region: { select: { id: true, name: true } },
            },
          },
          _count: { select: { users: true } },
        },
      }),
      deps.db.geoCommune.count(),
    ]);

    return {
      success: true,
      data: {
        countries,
        regions,
        departments,
        communes,
        communesTotal,
      },
    };
  } catch (error: any) {
    console.error('Erreur récupération admin GEO:', error);
    return { success: false, error: error.message || 'Erreur lors de la récupération des données GEO.' };
  }
}

// --- Création d'une entrée ---

export async function _createGeoEntry(
  type: GeoEntityType,
  data: { name: string; code?: string; parentId?: string },
  deps: AdminGeoDeps,
  roleOverride?: string
) {
  try {
    await deps.requireSuperAdmin(roleOverride);

    if (!data.name || !data.name.trim()) {
      return { success: false, error: 'Le nom est obligatoire.' };
    }
    const cleanName = data.name.trim();

    if (type === 'country') {
      if (!data.code || !data.code.trim()) {
        return { success: false, error: 'Le code pays est obligatoire (ex: SN).' };
      }
      const cleanCode = data.code.trim().toUpperCase();
      const country = await deps.db.geoCountry.create({
        data: {
          code: cleanCode,
          name: cleanName,
          active: true,
        },
      });
      return { success: true, entry: country };
    }

    if (!data.parentId || !data.parentId.trim()) {
      return { success: false, error: 'Le parent est obligatoire.' };
    }
    const parentId = data.parentId.trim();

    if (type === 'region') {
      const region = await deps.db.geoRegion.create({
        data: {
          countryId: parentId,
          name: cleanName,
          active: true,
        },
      });
      return { success: true, entry: region };
    }

    if (type === 'department') {
      const dept = await deps.db.geoDepartment.create({
        data: {
          regionId: parentId,
          name: cleanName,
          active: true,
        },
      });
      return { success: true, entry: dept };
    }

    if (type === 'commune') {
      const commune = await deps.db.geoCommune.create({
        data: {
          departmentId: parentId,
          name: cleanName,
          active: true,
        },
      });
      return { success: true, entry: commune };
    }

    return { success: false, error: 'Type d\'entité inconnu.' };
  } catch (error: any) {
    console.error('Erreur création entrée GEO:', error);
    return { success: false, error: error.message || 'Impossible de créer l\'entrée GEO.' };
  }
}

// --- Activer / Désactiver ---

export async function _toggleGeoActive(
  type: GeoEntityType,
  id: string,
  active: boolean,
  deps: AdminGeoDeps,
  roleOverride?: string
) {
  try {
    await deps.requireSuperAdmin(roleOverride);

    if (!id || !id.trim()) {
      return { success: false, error: 'Identifiant invalide.' };
    }
    const cleanId = id.trim();

    if (type === 'country') {
      const updated = await deps.db.geoCountry.update({
        where: { id: cleanId },
        data: { active },
      });
      return { success: true, entry: updated };
    }

    if (type === 'region') {
      const updated = await deps.db.geoRegion.update({
        where: { id: cleanId },
        data: { active },
      });
      return { success: true, entry: updated };
    }

    if (type === 'department') {
      const updated = await deps.db.geoDepartment.update({
        where: { id: cleanId },
        data: { active },
      });
      return { success: true, entry: updated };
    }

    if (type === 'commune') {
      const updated = await deps.db.geoCommune.update({
        where: { id: cleanId },
        data: { active },
      });
      return { success: true, entry: updated };
    }

    return { success: false, error: 'Type d\'entité inconnu.' };
  } catch (error: any) {
    console.error('Erreur toggle active GEO:', error);
    return { success: false, error: error.message || 'Impossible de modifier l\'état actif.' };
  }
}

// --- Public Server Actions ---

const defaultDeps: AdminGeoDeps = {
  db: prisma,
  requireSuperAdmin: defaultRequireSuperAdmin,
};

export async function getAdminGeoOverview() {
  return _getAdminGeoOverview(defaultDeps);
}

export async function createAdminGeoEntry(
  type: GeoEntityType,
  data: { name: string; code?: string; parentId?: string }
) {
  return _createGeoEntry(type, data, defaultDeps);
}

export async function toggleAdminGeoActive(
  type: GeoEntityType,
  id: string,
  active: boolean
) {
  return _toggleGeoActive(type, id, active, defaultDeps);
}
