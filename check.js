const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.mjdvoszkecoxpiwndvgv:Nousavonslememe@aws-1-eu-north-1.pooler.supabase.com:5432/postgres'
});

async function main() {
  await client.connect();
  const res = await client.query(`SELECT type, montant FROM "Transaction"`);
  console.log(res.rows);
  await client.end();
}

main().catch(console.error);
