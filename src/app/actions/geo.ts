'use server';

import prisma from '@/lib/prisma';
import { requireClient } from '@/lib/client-auth';

export interface GeoActionsDeps {
  db: any;
  requireClient: () => Promise<{ id: string }>;
}

export async function _getGeoRegions(deps: { db: any }) {
  try {
    const regions = await deps.db.geoRegion.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return { success: true, regions };
  } catch (error) {
    console.error('Erreur récupération régions:', error);
    return { success: false, error: 'Impossible de charger les régions.' };
  }
}

export async function _getGeoDepartments(regionId: string, deps: { db: any }) {
  try {
    if (!regionId || typeof regionId !== 'string' || !regionId.trim()) {
      return { success: false, error: 'Identifiant de région invalide.' };
    }

    // Validation stricte : la région parente doit exister et être active
    const parentRegion = await deps.db.geoRegion.findUnique({
      where: { id: regionId.trim() },
      select: { id: true, active: true },
    });

    if (!parentRegion || !parentRegion.active) {
      return { success: false, error: 'Région invalide ou inactive.' };
    }

    const departments = await deps.db.geoDepartment.findMany({
      where: {
        regionId: regionId.trim(),
        active: true,
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, regionId: true },
    });
    return { success: true, departments };
  } catch (error) {
    console.error('Erreur récupération départements:', error);
    return { success: false, error: 'Impossible de charger les départements.' };
  }
}

export async function _getGeoCommunes(departmentId: string, deps: { db: any }) {
  try {
    if (!departmentId || typeof departmentId !== 'string' || !departmentId.trim()) {
      return { success: false, error: 'Identifiant de département invalide.' };
    }

    // Validation stricte : le département parent doit exister, être actif et lié à une région active
    const parentDept = await deps.db.geoDepartment.findUnique({
      where: { id: departmentId.trim() },
      include: { region: { select: { id: true, active: true } } },
    });

    if (!parentDept || !parentDept.active || !parentDept.region?.active) {
      return { success: false, error: 'Département invalide ou inactif.' };
    }

    const communes = await deps.db.geoCommune.findMany({
      where: {
        departmentId: departmentId.trim(),
        active: true,
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, departmentId: true },
    });
    return { success: true, communes };
  } catch (error) {
    console.error('Erreur récupération communes:', error);
    return { success: false, error: 'Impossible de charger les communes.' };
  }
}

export async function _updateUserCommune(
  communeId: string | null | undefined,
  deps: GeoActionsDeps
) {
  try {
    const client = await deps.requireClient();

    // Champ facultatif : si null ou chaîne vide, on autorise la désassignation
    if (!communeId || (typeof communeId === 'string' && !communeId.trim())) {
      await deps.db.user.update({
        where: { id: client.id },
        data: { geoCommuneId: null },
      });
      return { success: true, message: 'Commune mise à jour avec succès.', geoCommuneId: null };
    }

    const cleanCommuneId = communeId.trim();

    // Validation stricte côté serveur :
    // 1. Commune existe
    // 2. Commune active
    // 3. Département parent existe et actif
    // 4. Région parente existe et active
    const commune = await deps.db.geoCommune.findUnique({
      where: { id: cleanCommuneId },
      include: {
        department: {
          include: {
            region: true,
          },
        },
      },
    });

    if (!commune) {
      return { success: false, error: 'La commune sélectionnée n\'existe pas.' };
    }

    if (!commune.active) {
      return { success: false, error: 'La commune sélectionnée est inactive.' };
    }

    if (!commune.department || !commune.department.active) {
      return { success: false, error: 'Le département parent est invalide ou inactif.' };
    }

    if (!commune.department.region || !commune.department.region.active) {
      return { success: false, error: 'La région parente est invalide ou inactive.' };
    }

    await deps.db.user.update({
      where: { id: client.id },
      data: { geoCommuneId: commune.id },
    });

    return {
      success: true,
      message: 'Commune mise à jour avec succès.',
      geoCommuneId: commune.id,
      commune: {
        id: commune.id,
        name: commune.name,
        departmentId: commune.department.id,
        departmentName: commune.department.name,
        regionId: commune.department.region.id,
        regionName: commune.department.region.name,
      },
    };
  } catch (error) {
    console.error('Erreur mise à jour commune utilisateur:', error);
    return { success: false, error: 'Impossible de mettre à jour la localisation.' };
  }
}

export async function _getUserGeoLocation(deps: GeoActionsDeps) {
  try {
    const client = await deps.requireClient();
    const user = await deps.db.user.findUnique({
      where: { id: client.id },
      select: {
        geoCommuneId: true,
        geoCommune: {
          select: {
            id: true,
            name: true,
            active: true,
            department: {
              select: {
                id: true,
                name: true,
                active: true,
                region: {
                  select: {
                    id: true,
                    name: true,
                    active: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.geoCommune) {
      return { success: true, location: null };
    }

    return {
      success: true,
      location: {
        communeId: user.geoCommune.id,
        communeName: user.geoCommune.name,
        departmentId: user.geoCommune.department.id,
        departmentName: user.geoCommune.department.name,
        regionId: user.geoCommune.department.region.id,
        regionName: user.geoCommune.department.region.name,
      },
    };
  } catch (error) {
    console.error('Erreur récupération localisation utilisateur:', error);
    return { success: false, error: 'Impossible de récupérer la localisation.' };
  }
}

// --- Public Server Actions ---

export async function getGeoRegions() {
  return _getGeoRegions({ db: prisma });
}

export async function getGeoDepartments(regionId: string) {
  return _getGeoDepartments(regionId, { db: prisma });
}

export async function getGeoCommunes(departmentId: string) {
  return _getGeoCommunes(departmentId, { db: prisma });
}

export async function updateUserCommune(communeId: string | null) {
  return _updateUserCommune(communeId, { db: prisma, requireClient });
}

export async function getUserGeoLocation() {
  return _getUserGeoLocation({ db: prisma, requireClient });
}
