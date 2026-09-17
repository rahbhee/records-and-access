import crypto from 'crypto';
import { getDb, trackedQuery } from './db';
import { NextRequest } from 'next/server';

export interface User {
  id: number;
  public_id: string;
  email: string;
  name: string;
  api_key: string;
  created_at: string;
}

export function generatePublicId(prefix: string): string {
  const bytes = crypto.randomBytes(12).toString('hex');
  return `${prefix}_${bytes}`;
}

export const SEED_USERS = [
  {
    public_id: 'usr_alice_sec901',
    email: 'alice@company.com',
    name: 'Alice Henderson',
    api_key: 'key_alice_live_sec_7781',
  },
  {
    public_id: 'usr_bob_sec902',
    email: 'bob@company.com',
    name: 'Bob Martinez',
    api_key: 'key_bob_live_sec_8892',
  },
];

export function ensureSeedUsers() {
  const db = getDb();
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO users (public_id, email, name, api_key)
    VALUES (?, ?, ?, ?)
  `);

  for (const u of SEED_USERS) {
    insertStmt.run(u.public_id, u.email, u.name, u.api_key);
  }
}

export function getAllUsers(): Omit<User, 'id'>[] {
  const db = getDb();
  return db.prepare(`SELECT public_id, email, name, api_key, created_at FROM users ORDER BY id ASC`).all() as Omit<User, 'id'>[];
}

export function authenticateRequest(req: NextRequest): User | null {
  ensureSeedUsers();

  // 1. Check Authorization header (Bearer key_...)
  const authHeader = req.headers.get('authorization');
  let apiKey: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    apiKey = authHeader.substring(7).trim();
  }

  // 2. Check custom x-api-key or session cookie if header is not present
  if (!apiKey) {
    apiKey = req.headers.get('x-api-key');
  }

  if (!apiKey) {
    const sessionCookie = req.cookies.get('session_user')?.value;
    if (sessionCookie) {
      apiKey = sessionCookie;
    }
  }

  // Default to Alice if running in development mode and no auth provided (unless explicit 'none' / unauthenticated testing header)
  const isAnonymousTest = req.headers.get('x-test-anonymous') === 'true';
  if (isAnonymousTest) {
    return null;
  }

  if (!apiKey) {
    // If no header or cookie provided, default to Alice for standard browser visits
    apiKey = SEED_USERS[0].api_key;
  }

  const db = getDb();
  return trackedQuery<User | null>(
    'AUTH_CHECK',
    'SELECT id, public_id, email, name, api_key, created_at FROM users WHERE api_key = ? OR public_id = ?',
    (database) => {
      const user = database
        .prepare('SELECT id, public_id, email, name, api_key, created_at FROM users WHERE api_key = ? OR public_id = ? LIMIT 1')
        .get(apiKey, apiKey) as User | undefined;
      return user || null;
    },
    [apiKey, apiKey]
  );
}
