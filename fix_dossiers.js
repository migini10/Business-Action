const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const dossiers = await prisma.dossier.findMany({ where: { clientId: null } });
  for (const dossier of dossiers) {
    const user = await prisma.user.findUnique({ where: { phone: dossier.phone } });
    if (user) {
      await prisma.dossier.update({
        where: { id: dossier.id },
        data: { clientId: user.id }
      });
      console.log(`Linked dossier ${dossier.numeroDossier} to user ${user.fullName}`);
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
