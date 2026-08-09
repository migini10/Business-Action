const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const creances = await prisma.transaction.findMany({
    where: {
      type: 'CREANCE',
      montant: { lt: 0 }
    }
  });
  
  console.log(`Found ${creances.length} creances to fix.`);
  
  for (const c of creances) {
    await prisma.transaction.update({
      where: { id: c.id },
      data: { montant: Math.abs(c.montant) }
    });
  }
  
  console.log('Fixed creances.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
