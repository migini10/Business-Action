import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { resolvePoolSslConfig } from './database-ssl'

const prismaClientSingleton = () => {
  // Retire les guillemets si l'utilisateur les a copiées par erreur sur Vercel
  const rawConnectionString = (process.env.DATABASE_URL || '').replace(/^"|"$/g, '').trim()

  // TLS strict par défaut (Supabase), ou explicitement assoupli via
  // DATABASE_RUNTIME_SSL_MODE (voir src/lib/database-ssl.ts et .env.example)
  // pour un Postgres local (ex: DigitalOcean Docker sur réseau privé).
  const { connectionString, ssl } = resolvePoolSslConfig(rawConnectionString, process.env.DATABASE_RUNTIME_SSL_MODE)

  const pool = new Pool({
    connectionString,
    ssl
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
