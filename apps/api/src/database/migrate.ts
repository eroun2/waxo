// Forward-only migration runner: applies migrations/*.sql in order, once each.
import { Client } from 'pg';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import * as dns from 'dns';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

async function createClient(cs: string): Promise<Client> {
  const url = new URL(cs);
  const hostname = url.hostname;
  let host = hostname;
  try {
    const addrs = await dns.promises.resolve4(hostname);
    if (addrs && addrs.length > 0) host = addrs[0];
  } catch {}

  const isCloud = cs.includes('supabase.com') || cs.includes('sslmode=require');
  return new Client({
    host,
    port: Number(url.port) || 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, '') || 'postgres',
    ssl: isCloud ? { servername: hostname, rejectUnauthorized: false } : undefined,
  });
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set in environment.');
  }

  const c = await createClient(connectionString);
  await c.connect();
  console.log('Connected to database. Checking schema_migrations...');
  await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const dir = join(__dirname, '..', '..', 'migrations');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    const done = await c.query('SELECT 1 FROM schema_migrations WHERE name=$1', [f]);
    if (done.rowCount) {
      console.log('Skipping (already applied):', f);
      continue;
    }
    console.log('Applying', f, '...');
    await c.query(readFileSync(join(dir, f), 'utf8'));
    await c.query('INSERT INTO schema_migrations(name) VALUES ($1)', [f]);
  }
  console.log('All migrations applied successfully!');
  await c.end();
}
main().catch((e) => { console.error('Migration failed:', e); process.exit(1); });
