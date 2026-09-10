import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma';

export interface GeoSeedData {
  country: { code: string; name: string };
  regions: Array<{
    name: string;
    departments: Array<{
      name: string;
      communes: string[];
    }>;
  }>;
}

export async function seedGeo(prismaClient: any, dataOrPath?: string | GeoSeedData) {
  let data: GeoSeedData;
  if (!dataOrPath || typeof dataOrPath === 'string') {
    const filePath = dataOrPath || path.join(process.cwd(), 'prisma', 'geo-data', 'senegal.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    data = JSON.parse(raw);
  } else {
    data = dataOrPath;
  }

  // 1. Country: upsert par code
  // active=true uniquement à la création, jamais de désactivation ni écrasement d'active
  const country = await prismaClient.geoCountry.upsert({
    where: { code: data.country.code },
    create: {
      code: data.country.code,
      name: data.country.name,
      active: true,
    },
    update: {
      name: data.country.name,
    },
  });

  const stats = {
    countryCode: country.code,
    regions: 0,
    departments: 0,
    communes: 0,
  };

  // 2. Regions: upsert par countryId + name
  for (const regionData of data.regions) {
    const region = await prismaClient.geoRegion.upsert({
      where: {
        countryId_name: {
          countryId: country.id,
          name: regionData.name,
        },
      },
      create: {
        countryId: country.id,
        name: regionData.name,
        active: true,
      },
      update: {},
    });
    stats.regions++;

    // 3. Departments: upsert par regionId + name
    for (const deptData of regionData.departments) {
      const dept = await prismaClient.geoDepartment.upsert({
        where: {
          regionId_name: {
            regionId: region.id,
            name: deptData.name,
          },
        },
        create: {
          regionId: region.id,
          name: deptData.name,
          active: true,
        },
        update: {},
      });
      stats.departments++;

      // 4. Communes: upsert par departmentId + name
      for (const communeName of deptData.communes) {
        await prismaClient.geoCommune.upsert({
          where: {
            departmentId_name: {
              departmentId: dept.id,
              name: communeName,
            },
          },
          create: {
            departmentId: dept.id,
            name: communeName,
            active: true,
          },
          update: {},
        });
        stats.communes++;
      }
    }
  }

  return { success: true, stats };
}

// Standalone runner si exécuté directement (ex: npx tsx prisma/seed-geo.ts)
if (process.argv[1] && process.argv[1].endsWith('seed-geo.ts')) {
  console.log('Seed GEO standalone runner initialisé...');
  seedGeo(prisma)
    .then((res) => {
      console.log('Seed GEO terminé avec succès :', res.stats);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Erreur lors du seed GEO :', err);
      process.exit(1);
    });
}
