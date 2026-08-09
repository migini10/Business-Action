import prisma from '../../src/lib/prisma';

async function clearDatabase() {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production' || process.env.NEXT_PUBLIC_VERCEL_ENV === 'production') {
    console.error('⛔ ERREUR : Exécution interdite en production.');
    process.exit(1);
  }

  if (process.env.ALLOW_DESTRUCTIVE_DB_OPERATIONS !== 'true') {
    console.error('⛔ ERREUR : La variable d\'environnement ALLOW_DESTRUCTIVE_DB_OPERATIONS=true est requise.');
    process.exit(1);
  }

  try {
    console.log('Nettoyage de la base de données...');
    
    await prisma.transaction.deleteMany();
    await prisma.echeance.deleteMany();
    await prisma.dossier.deleteMany();
    await prisma.user.deleteMany();
    
    console.log('Base de données réinitialisée avec succès ! ✅');
  } catch (error) {
    console.error('Erreur lors du nettoyage de la base de données:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearDatabase();
