// Forward-only migration runner: applies migrations/*.sql in order, once each.
import { Client } from 'pg';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const dir = join(__dirname, '..', '..', 'migrations');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    const done = await c.query('SELECT 1 FROM schema_migrations WHERE name=$1', [f]);
    if (done.rowCount) continue;
    console.log('Applying', f);
    await c.query(readFileSync(join(dir, f), 'utf8'));
    await c.query('INSERT INTO schema_migrations(name) VALUES ($1)', [f]);
  }
  await c.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
