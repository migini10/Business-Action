import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const dossiers = await prisma.dossier.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3
  })
  console.log("--- RECENT DOSSIERS URLS ---")
  dossiers.forEach(d => {
    console.log(`ID: ${d.id}`)
    console.log(`Recto: ${d.rectoUrl}`)
    console.log(`Verso: ${d.versoUrl}`)
    console.log('---')
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
