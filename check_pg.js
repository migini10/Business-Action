require('dotenv').config()
const { Client } = require('pg')

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })
  await client.connect()
  const res = await client.query('SELECT "id", "rectoUrl", "versoUrl" FROM "Dossier" ORDER BY "createdAt" DESC LIMIT 3')
  console.log(res.rows)
  await client.end()
}
main().catch(console.error)
