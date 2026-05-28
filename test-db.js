const { PrismaClient } = require('@prisma/client')
const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')
require('dotenv').config()

async function main() {
  const connectionString = process.env.DATABASE_URL
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })
  
  try {
    const d = await prisma.dossier.create({
      data: {
        phone: '123',
        email: 'test@test.com',
        typeVehicule: 'PARTICULIER',
        numeroDossier: 'TEST-' + Date.now()
      }
    })
    console.log("Success:", d.id)
  } catch (e) {
    console.error("Prisma error:", e)
  }
}
main()
