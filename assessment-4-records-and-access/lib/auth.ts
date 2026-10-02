import { randomBytes } from 'crypto';
import { getDb } from './db';

export interface User {
  id: number;
  public_id: string;
  email: string;
  name: string;
  api_key: string;
}

// Demo tenants. The api_key acts as the bearer credential for each tenant.
// DEV/DEMO ONLY: a real product would use sessions or signed tokens (Assessment 1).
export const SEED_USERS = [
  { name: 'Alice', email: 'alice@company.com', api_key: 'key_alice_live_sec_7781' },
  { name: 'Bob', email: 'bob@company.com', api_key: 'key_bob_live_sec_4492' },
] as const;

// Prefixed, non-sequential public identifier, e.g. "rec_4f2a9c1b8e3d".
// Used anywhere an id is exposed in a URL or UI -- never the raw row id.
export function generatePublicId(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString('hex')}`;
}

// Idempotent: safe to call on every request or script start.
export function ensureSeedUsers(): void {
  const db = getDb();
  const insert = db.prepare(
    'INSERT OR IGNORE INTO users (public_id, email, name, api_key) VALUES (?, ?, ?, ?)'
  );
  for (const u of SEED_USERS) {
    insert.run(generatePublicId('usr'), u.email, u.name, u.api_key);
  }
}

// Used by the tenant switcher. Exposes demo credentials on purpose.
export function getAllUsers(): Array<Pick<User, 'public_id' | 'name' | 'email' | 'api_key'>> {
  return getDb()
    .prepare('SELECT public_id, name, email, api_key FROM users ORDER BY id')
    .all() as Array<Pick<User, 'public_id' | 'name' | 'email' | 'api_key'>>;
}

// Returns null for both "no token" and "bad token": callers just answer 401.
export function authenticateRequest(request: Request): User | null {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const user = getDb()
    .prepare('SELECT id, public_id, email, name, api_key FROM users WHERE api_key = ?')
    .get(token) as User | undefined;
  return user ?? null;
}
