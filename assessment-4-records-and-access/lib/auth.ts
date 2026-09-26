import { getDb } from './db';

export interface User {
  id: number;
  public_id: string;
  email: string;
  api_key: string;
}

/**
 * Utility to generate prefix-based public IDs (e.g., rec_abc123, aud_xyz789)
 */
export function generatePublicId(prefix: string): string {
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${random}`;
}

/**
 * Synchronous request authentication helper for route handlers
 */
export function authenticateRequest(req: Request): User | null {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return null;

  try {
    const db = getDb();
    const user = db
      .prepare('SELECT id, public_id, email, api_key FROM users WHERE api_key = ?')
      .get(token) as User | undefined;
    return user || null;
  } catch {
    return null;
  }
}

/**
 * Async helper for token lookup
 */
export async function getUserFromToken(request: Request): Promise<User | null> {
  return authenticateRequest(request);
}