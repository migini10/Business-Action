import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const testDbUrl = process.env.TEST_DATABASE_URL;
const mainDbUrl = process.env.DATABASE_URL;

if (!testDbUrl) {
  console.error('\n[FATAL ERROR] TEST_DATABASE_URL is not set.');
  console.error('Tests must not run against the development/production database.');
  process.exit(1);
}

if (mainDbUrl && testDbUrl === mainDbUrl) {
  console.error('\n[FATAL ERROR] TEST_DATABASE_URL is identical to DATABASE_URL.');
  console.error('Tests must run against a completely isolated database.');
  process.exit(1);
}

const connectionString = testDbUrl.replace(/^"|"$/g, '').trim();

const pool = new Pool({
  connectionString,
  ssl: false
});

const adapter = new PrismaPg(pool);
const testPrisma = new PrismaClient({ adapter });

export default testPrisma;
