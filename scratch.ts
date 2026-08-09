import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import prisma from './src/lib/prisma';
async function main() {
  const txs = await prisma.transaction.findMany();
  const stats = {
    total: txs.length,
    byType: {} as Record<string, any>,
    signs: { positive: 0, negative: 0, zero: 0 }
  };
  for (const tx of txs) {
    if (!stats.byType[tx.type]) stats.byType[tx.type] = { count: 0, sum: 0, pos: 0, neg: 0 };
    stats.byType[tx.type].count++;
    stats.byType[tx.type].sum += tx.montant;
    if (tx.montant > 0) { stats.byType[tx.type].pos++; stats.signs.positive++; }
    else if (tx.montant < 0) { stats.byType[tx.type].neg++; stats.signs.negative++; }
    else { stats.signs.zero++; }
  }
  console.log(JSON.stringify(stats, null, 2));
}
main().finally(() => prisma.$disconnect());
