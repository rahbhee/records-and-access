import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { queryTracker } from './query-tracker';

const dbPath = process.env.DATABASE_PATH || './data/records_access.db';
const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);

// Ensure data directory exists
const dataDir = path.dirname(resolvedDbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(resolvedDbPath);
    // Enforce foreign key constraints and enable WAL mode for high performance concurrency
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    dbInstance.pragma('synchronous = NORMAL');
    initSchema(dbInstance);
  }
  return dbInstance;
}

export function trackedQuery<T>(
  actionName: string,
  sql: string,
  fn: (db: Database.Database) => T,
  params: unknown[] = []
): T {
  const start = performance.now();
  const db = getDb();
  const result = fn(db);
  const duration = performance.now() - start;
  queryTracker.record(sql, params, actionName, duration);
  return result;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      api_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      user_email TEXT NOT NULL,
      record_public_id TEXT NOT NULL,
      record_title TEXT NOT NULL,
      action TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Composite and unique indexes for fast scoped queries and zero full-table scans
    CREATE INDEX IF NOT EXISTS idx_records_user_created ON records (user_id, created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_records_user_public ON records (user_id, public_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_records_public_id ON records (public_id);
    CREATE INDEX IF NOT EXISTS idx_audit_user_created ON audit_logs (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_users_api_key ON users (api_key);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_id ON users (public_id);
  `);
}
