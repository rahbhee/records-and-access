import { randomBytes } from 'crypto';
import { getDb } from './db';

// The rest of the app (lib/records.ts) reads and writes through raw SQLite
// via getDb() -- this file previously used Prisma instead, which is why
// nothing here actually matched: a different database layer entirely, and
// one that was never initialized for this project, hence the recurring
// "Prisma client did not initialize yet" error every time this file (or
// anything importing it) was touched.

export interface User {
  id: number;
  public_id: string;
  email: string;
  name: string;
  api_key: string;
}

// Generates a prefixed public identifier, e.g. generatePublicId('rec') ->
// "rec_4f2a9c1b8e3d". Used everywhere a record, audit log entry, or user
// needs an id safe to expose in a URL -- never the raw database row id.
export function generatePublicId(prefix: string): string {
  const random = randomBytes(6).toString('hex');
  return `${prefix}_${random}`;
}

// Called synchronously at the top of every protected route:
//   const user = authenticateRequest(req);
//   if (!user) return 401;
// Reads the Bearer token, looks up the matching user by api_key directly
// against SQLite, and returns null if there's no token or no match --
// callers never need to know the difference between "no token" and
// "bad token," both are simply "not authenticated."
export function authenticateRequest(request: Request): User | null {
  const auth = request.headers.get('Authorization') ?? '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return null;

  const db = getDb();
  const user = db
    .prepare('SELECT id, public_id, email, name, api_key FROM users WHERE api_key = ?')
    .get(token) as User | undefined;

  return user ?? null;
}