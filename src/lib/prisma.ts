import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const prismaClientSingleton = () => {
  // Retire les guillemets si l'utilisateur les a copiés par erreur sur Vercel
  const connectionString = (process.env.DATABASE_URL || '').replace(/^"|"$/g, '').trim()
  
  const pool = new Pool({ 
    connectionString,
    // Supabase nécessite SSL pour toutes les connexions (même en local)
    ssl: { rejectUnauthorized: false }
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
