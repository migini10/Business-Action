import prisma from './src/lib/prisma';

async function clearDatabase() {
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
