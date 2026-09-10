import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

import {
  _getGeoRegions,
  _getGeoDepartments,
  _getGeoCommunes,
  _updateUserCommune,
  _getUserGeoLocation,
} from '../app/actions/geo';

import {
  _getAdminGeoOverview,
  _createGeoEntry,
  _toggleGeoActive,
  defaultRequireSuperAdmin,
} from '../app/actions/admin-geo';

import { seedGeo } from '../../prisma/seed-geo';

// ==========================================
// 1. DATA VALIDATION
// ==========================================
test('GEO DATA: Validation du fichier sénégal.json', async (t) => {
  const filePath = path.join(process.cwd(), 'prisma', 'geo-data', 'senegal.json');

  await t.test('JSON valide', () => {
    assert.ok(fs.existsSync(filePath), 'Le fichier prisma/geo-data/senegal.json doit exister');
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    assert.ok(data, 'Le JSON doit être parsable');
    assert.ok(data.country, 'Le pays doit être défini');
    assert.strictEqual(data.country.code, 'SN');
  });

  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);

  await t.test('14 régions exactes', () => {
    assert.strictEqual(data.regions.length, 14);
  });

  await t.test('46 départements exacts', () => {
    let deptCount = 0;
    for (const r of data.regions) {
      deptCount += r.departments.length;
    }
    assert.strictEqual(deptCount, 46);
  });

  await t.test('553 communes exactes', () => {
    let communeCount = 0;
    for (const r of data.regions) {
      for (const d of r.departments) {
        communeCount += d.communes.length;
      }
    }
    assert.strictEqual(communeCount, 553);
  });

  await t.test('0 département orphelin et 0 commune orpheline', () => {
    let orphanDepts = 0;
    let orphanCommunes = 0;
    for (const r of data.regions) {
      if (!r.name || !r.name.trim()) orphanDepts++;
      for (const d of r.departments) {
        if (!d.name || !d.name.trim()) orphanCommunes++;
        for (const c of d.communes) {
          if (!c || !c.trim()) orphanCommunes++;
        }
      }
    }
    assert.strictEqual(orphanDepts, 0);
    assert.strictEqual(orphanCommunes, 0);
  });

  await t.test('0 doublon dans un même parent', () => {
    const regionNames = new Set<string>();
    let duplicatesWithinParent = 0;

    for (const r of data.regions) {
      const rKey = r.name.toLowerCase().trim();
      if (regionNames.has(rKey)) duplicatesWithinParent++;
      regionNames.add(rKey);

      const deptNames = new Set<string>();
      for (const d of r.departments) {
        const dKey = d.name.toLowerCase().trim();
        if (deptNames.has(dKey)) duplicatesWithinParent++;
        deptNames.add(dKey);

        const communeNames = new Set<string>();
        for (const c of d.communes) {
          const cKey = c.toLowerCase().trim();
          if (communeNames.has(cKey)) duplicatesWithinParent++;
          communeNames.add(cKey);
        }
      }
    }
    assert.strictEqual(duplicatesWithinParent, 0);
  });
});

// ==========================================
// 2. SEED IDEMPOTENCE
// ==========================================
test('GEO SEED: Idempotence et absence de suppression', async (t) => {
  const store = {
    countries: new Map<string, any>(),
    regions: new Map<string, any>(),
    departments: new Map<string, any>(),
    communes: new Map<string, any>(),
    deleteManyCalled: false,
  };

  const mockPrisma: any = {
    geoCountry: {
      upsert: async ({ where, create, update }: any) => {
        if (!store.countries.has(where.code)) {
          const item = { id: 'c-sn', ...create };
          store.countries.set(where.code, item);
          return item;
        }
        const existing = store.countries.get(where.code);
        Object.assign(existing, update);
        return existing;
      },
    },
    geoRegion: {
      upsert: async ({ where, create, update }: any) => {
        const key = `${where.countryId_name.countryId}_${where.countryId_name.name}`;
        if (!store.regions.has(key)) {
          const item = { id: `r-${store.regions.size + 1}`, ...create };
          store.regions.set(key, item);
          return item;
        }
        const existing = store.regions.get(key);
        Object.assign(existing, update);
        return existing;
      },
    },
    geoDepartment: {
      upsert: async ({ where, create, update }: any) => {
        const key = `${where.regionId_name.regionId}_${where.regionId_name.name}`;
        if (!store.departments.has(key)) {
          const item = { id: `d-${store.departments.size + 1}`, ...create };
          store.departments.set(key, item);
          return item;
        }
        const existing = store.departments.get(key);
        Object.assign(existing, update);
        return existing;
      },
    },
    geoCommune: {
      upsert: async ({ where, create, update }: any) => {
        const key = `${where.departmentId_name.departmentId}_${where.departmentId_name.name}`;
        if (!store.communes.has(key)) {
          const item = { id: `comm-${store.communes.size + 1}`, ...create };
          store.communes.set(key, item);
          return item;
        }
        const existing = store.communes.get(key);
        Object.assign(existing, update);
        return existing;
      },
      deleteMany: async () => {
        store.deleteManyCalled = true;
      },
    },
  };

  await t.test('Premier import complet', async () => {
    const res = await seedGeo(mockPrisma);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.stats.regions, 14);
    assert.strictEqual(res.stats.departments, 46);
    assert.strictEqual(res.stats.communes, 553);
    assert.strictEqual(store.regions.size, 14);
    assert.strictEqual(store.departments.size, 46);
    assert.strictEqual(store.communes.size, 553);
    assert.strictEqual(store.deleteManyCalled, false, 'deleteMany ne doit jamais être appelé');
  });

  await t.test('Second import idempotent sans doublon ni suppression', async () => {
    const res2 = await seedGeo(mockPrisma);
    assert.strictEqual(res2.success, true);
    assert.strictEqual(store.regions.size, 14, 'Aucune région en double');
    assert.strictEqual(store.departments.size, 46, 'Aucun département en double');
    assert.strictEqual(store.communes.size, 553, 'Aucune commune en double');
    assert.strictEqual(store.deleteManyCalled, false, 'deleteMany ne doit jamais être appelé');
  });
});

// ==========================================
// 3. ACTIONS CLIENT
// ==========================================
test('GEO CLIENT ACTIONS: Régions, Départements, Communes', async (t) => {
  const mockDb = {
    geoRegion: {
      findMany: async ({ where, orderBy }: any) => {
        assert.strictEqual(where.active, true, 'Seules les régions actives doivent être retournées');
        return [
          { id: 'reg-1', name: 'Dakar' },
          { id: 'reg-2', name: 'Thiès' },
        ];
      },
      findUnique: async ({ where }: any) => {
        if (where.id === 'reg-active') return { id: 'reg-active', active: true };
        if (where.id === 'reg-inactive') return { id: 'reg-inactive', active: false };
        return null;
      },
    },
    geoDepartment: {
      findMany: async ({ where }: any) => {
        assert.strictEqual(where.active, true);
        return [
          { id: 'dept-1', name: 'Dakar', regionId: where.regionId },
          { id: 'dept-2', name: 'Pikine', regionId: where.regionId },
        ];
      },
      findUnique: async ({ where }: any) => {
        if (where.id === 'dept-active') {
          return { id: 'dept-active', active: true, region: { id: 'reg-1', active: true } };
        }
        if (where.id === 'dept-inactive') {
          return { id: 'dept-inactive', active: false, region: { id: 'reg-1', active: true } };
        }
        if (where.id === 'dept-parent-inactive') {
          return { id: 'dept-parent-inactive', active: true, region: { id: 'reg-2', active: false } };
        }
        return null;
      },
    },
    geoCommune: {
      findMany: async ({ where }: any) => {
        assert.strictEqual(where.active, true);
        return [
          { id: 'comm-1', name: 'Plateau', departmentId: where.departmentId },
          { id: 'comm-2', name: 'Médina', departmentId: where.departmentId },
        ];
      },
    },
  };

  await t.test('getGeoRegions retourne uniquement les régions actives', async () => {
    const res = await _getGeoRegions({ db: mockDb });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.regions?.length, 2);
  });

  await t.test('getGeoDepartments filtre par regionId et valide le parent actif', async () => {
    const resValid = await _getGeoDepartments('reg-active', { db: mockDb });
    assert.strictEqual(resValid.success, true);
    assert.strictEqual(resValid.departments?.length, 2);

    const resInactive = await _getGeoDepartments('reg-inactive', { db: mockDb });
    assert.strictEqual(resInactive.success, false);
    assert.match(resInactive.error || '', /inactive/i);

    const resNotFound = await _getGeoDepartments('unknown', { db: mockDb });
    assert.strictEqual(resNotFound.success, false);

    const resEmpty = await _getGeoDepartments('', { db: mockDb });
    assert.strictEqual(resEmpty.success, false);
  });

  await t.test('getGeoCommunes filtre par departmentId et valide le parent actif', async () => {
    const resValid = await _getGeoCommunes('dept-active', { db: mockDb });
    assert.strictEqual(resValid.success, true);
    assert.strictEqual(resValid.communes?.length, 2);

    const resInactiveDept = await _getGeoCommunes('dept-inactive', { db: mockDb });
    assert.strictEqual(resInactiveDept.success, false);

    const resInactiveRegion = await _getGeoCommunes('dept-parent-inactive', { db: mockDb });
    assert.strictEqual(resInactiveRegion.success, false);

    const resEmpty = await _getGeoCommunes('', { db: mockDb });
    assert.strictEqual(resEmpty.success, false);
  });
});

// ==========================================
// 4. USER COMMUNE ASSIGNMENT & VALIDATION
// ==========================================
test('GEO USER: Validation stricte et mise à jour de la commune', async (t) => {
  let updatedUserId: string | null = null;
  let updatedCommuneId: string | null | undefined = undefined;

  const mockDb = {
    user: {
      update: async ({ where, data }: any) => {
        updatedUserId = where.id;
        updatedCommuneId = data.geoCommuneId;
        return { id: where.id, ...data };
      },
      findUnique: async () => ({
        geoCommuneId: 'comm-1',
        geoCommune: {
          id: 'comm-1',
          name: 'Plateau',
          active: true,
          department: {
            id: 'dept-1',
            name: 'Dakar',
            active: true,
            region: {
              id: 'reg-1',
              name: 'Dakar',
              active: true,
            },
          },
        },
      }),
    },
    geoCommune: {
      findUnique: async ({ where }: any) => {
        if (where.id === 'comm-valid') {
          return {
            id: 'comm-valid',
            name: 'Plateau',
            active: true,
            department: {
              id: 'dept-1',
              name: 'Dakar',
              active: true,
              region: { id: 'reg-1', name: 'Dakar', active: true },
            },
          };
        }
        if (where.id === 'comm-inactive') {
          return {
            id: 'comm-inactive',
            name: 'Ancienne Commune',
            active: false,
            department: {
              id: 'dept-1',
              name: 'Dakar',
              active: true,
              region: { id: 'reg-1', name: 'Dakar', active: true },
            },
          };
        }
        if (where.id === 'comm-inactive-dept') {
          return {
            id: 'comm-inactive-dept',
            name: 'Commune X',
            active: true,
            department: {
              id: 'dept-inactive',
              name: 'Dept Inactif',
              active: false,
              region: { id: 'reg-1', name: 'Dakar', active: true },
            },
          };
        }
        if (where.id === 'comm-inactive-region') {
          return {
            id: 'comm-inactive-region',
            name: 'Commune Y',
            active: true,
            department: {
              id: 'dept-1',
              name: 'Dakar',
              active: true,
              region: { id: 'reg-inactive', name: 'Région Inactive', active: false },
            },
          };
        }
        return null;
      },
    },
  };

  const deps = {
    db: mockDb,
    requireClient: async () => ({ id: 'client-user-1' }),
  };

  await t.test('geoCommuneId nullable: autorise désassignation si null ou vide', async () => {
    const res = await _updateUserCommune(null, deps);
    assert.strictEqual(res.success, true);
    assert.strictEqual(updatedCommuneId, null);
    assert.strictEqual(updatedUserId, 'client-user-1');

    const resEmpty = await _updateUserCommune('', deps);
    assert.strictEqual(resEmpty.success, true);
    assert.strictEqual(updatedCommuneId, null);
  });

  await t.test('Commune valide avec parents actifs acceptée', async () => {
    const res = await _updateUserCommune('comm-valid', deps);
    assert.strictEqual(res.success, true);
    assert.strictEqual(updatedCommuneId, 'comm-valid');
    assert.strictEqual(res.commune?.name, 'Plateau');
    assert.strictEqual(res.commune?.departmentName, 'Dakar');
    assert.strictEqual(res.commune?.regionName, 'Dakar');
  });

  await t.test('Commune inexistante refusée côté serveur', async () => {
    const res = await _updateUserCommune('non-existent-id', deps);
    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /n'existe pas/i);
  });

  await t.test('Commune inactive refusée côté serveur', async () => {
    const res = await _updateUserCommune('comm-inactive', deps);
    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /inactive/i);
  });

  await t.test('Commune dont le département est inactif refusée', async () => {
    const res = await _updateUserCommune('comm-inactive-dept', deps);
    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /département/i);
  });

  await t.test('Commune dont la région est inactive refusée', async () => {
    const res = await _updateUserCommune('comm-inactive-region', deps);
    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /région/i);
  });

  await t.test('Restauration de la localisation utilisateur existante', async () => {
    const res = await _getUserGeoLocation(deps);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.location?.communeId, 'comm-1');
    assert.strictEqual(res.location?.communeName, 'Plateau');
    assert.strictEqual(res.location?.departmentName, 'Dakar');
    assert.strictEqual(res.location?.regionName, 'Dakar');
  });
});

// ==========================================
// 5. ADMIN GEO: SUPER_ADMIN ONLY
// ==========================================
test('GEO ADMIN: Contrôle strict SUPER_ADMIN', async (t) => {
  const mockDb: any = {
    geoCountry: {
      findMany: async () => [{ id: 'c1', name: 'Sénégal', code: 'SN' }],
      create: async ({ data }: any) => ({ id: 'c-new', ...data }),
      update: async ({ where, data }: any) => ({ id: where.id, ...data }),
    },
    geoRegion: {
      findMany: async () => [{ id: 'r1', name: 'Dakar' }],
      create: async ({ data }: any) => ({ id: 'r-new', ...data }),
      update: async ({ where, data }: any) => ({ id: where.id, ...data }),
    },
    geoDepartment: {
      findMany: async () => [{ id: 'd1', name: 'Dakar' }],
      create: async ({ data }: any) => ({ id: 'd-new', ...data }),
      update: async ({ where, data }: any) => ({ id: where.id, ...data }),
    },
    geoCommune: {
      findMany: async () => [{ id: 'cm1', name: 'Plateau' }],
      create: async ({ data }: any) => ({ id: 'cm-new', ...data }),
      update: async ({ where, data }: any) => ({ id: where.id, ...data }),
      count: async () => 553,
    },
  };

  const deps = {
    db: mockDb,
    requireSuperAdmin: defaultRequireSuperAdmin,
  };

  await t.test('SUPER_ADMIN autorisé', async () => {
    const overview = await _getAdminGeoOverview(deps, 'SUPER_ADMIN');
    assert.strictEqual(overview.success, true);
    assert.ok(overview.data?.countries);
    assert.strictEqual(overview.data?.communes.length, 1, "la liste paginée reste limitée (take:100), ici 1 vu le mock");
    assert.strictEqual(overview.data?.communesTotal, 553, "le total doit provenir d'un vrai count DB, pas de communes.length");

    const created = await _createGeoEntry('region', { name: 'Nouvelle Région', parentId: 'c1' }, deps, 'SUPER_ADMIN');
    assert.strictEqual(created.success, true);
    assert.strictEqual(created.entry.name, 'Nouvelle Région');

    const toggled = await _toggleGeoActive('region', 'r1', false, deps, 'SUPER_ADMIN');
    assert.strictEqual(toggled.success, true);
    assert.strictEqual(toggled.entry.active, false);
  });

  await t.test('PASSENGER refusé avec refus clair', async () => {
    const res = await _getAdminGeoOverview(deps, 'PASSENGER');
    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /SUPER_ADMIN/);

    const resCreate = await _createGeoEntry('commune', { name: 'Test', parentId: 'd1' }, deps, 'PASSENGER');
    assert.strictEqual(resCreate.success, false);
    assert.match(resCreate.error || '', /SUPER_ADMIN/);
  });

  await t.test('DRIVER OWNER refusé avec refus clair', async () => {
    const res = await _getAdminGeoOverview(deps, 'DRIVER OWNER');
    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /SUPER_ADMIN/);

    const resToggle = await _toggleGeoActive('commune', 'cm1', false, deps, 'DRIVER OWNER');
    assert.strictEqual(resToggle.success, false);
    assert.match(resToggle.error || '', /SUPER_ADMIN/);
  });

  await t.test('DRIVER ASSIGNED refusé avec refus clair', async () => {
    const res = await _getAdminGeoOverview(deps, 'DRIVER ASSIGNED');
    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /SUPER_ADMIN/);
  });

  await t.test('Non-authentifié / CLIENT refusé', async () => {
    const res = await _getAdminGeoOverview(deps, 'CLIENT');
    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /SUPER_ADMIN/);
  });
});
