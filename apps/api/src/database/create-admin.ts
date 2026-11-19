// Usage (inside the api container):
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='long-passphrase' npm run create-admin
import { Client } from 'pg';
import * as bcrypt from 'bcryptjs';
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
  const { ADMIN_EMAIL, ADMIN_PASSWORD, DATABASE_URL } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (min 12 chars)');
  }
  const c = await createClient(DATABASE_URL!);
  await c.connect();
  const role = await c.query("SELECT id FROM admin_roles WHERE name = 'super_admin'");
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const r = await c.query(
    `INSERT INTO users(email, password_hash, role, admin_role_id, email_verified_at)
     VALUES ($1,$2,'admin',$3, now()) ON CONFLICT (email) DO NOTHING RETURNING id`,
    [ADMIN_EMAIL, hash, role.rows[0].id]);
  console.log(r.rowCount ? `Admin created: ${ADMIN_EMAIL}` : 'An account with that email already exists; nothing changed.');
  await c.end();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
