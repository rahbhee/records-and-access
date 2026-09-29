import { getDb, trackedQuery } from './db';
import { generatePublicId, User } from './auth';

export interface PublicRecord {
  public_id: string;
  title: string;
  category: string;
  content: string;
  amount_cents: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLogItem {
  public_id: string;
  user_email: string;
  record_public_id: string;
  record_title: string;
  action: string;
  metadata_json: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface CreateRecordInput {
  title: string;
  category: string;
  content: string;
  amount_cents: number;
}

/**
 * List only records belonging to the authenticated user.
 * Scoped directly in the SQL statement.
 */
export function listUserRecords(userId: number): PublicRecord[] {
  const sql = `
    SELECT public_id, title, category, content, amount_cents, status, created_at, updated_at
    FROM records
    WHERE user_id = ?
    ORDER BY created_at DESC
  `;
  return trackedQuery<PublicRecord[]>(
    'LIST_RECORDS',
    sql,
    (db) => db.prepare(sql).all(userId) as PublicRecord[],
    [userId]
  );
}

/**
 * Fetch a single record strictly scoped to the authenticated user.
 * If the record exists for another user, this returns null to prevent data leakage,
 * and we can check global existence if we need to return an explicit 403 Forbidden.
 */
export function getScopedRecord(
  userId: number,
  recordPublicId: string
): { record: PublicRecord | null; existsGlobally: boolean } {
  const scopedSql = `
    SELECT public_id, title, category, content, amount_cents, status, created_at, updated_at
    FROM records
    WHERE user_id = ? AND public_id = ?
    LIMIT 1
  `;

  const record = trackedQuery<PublicRecord | null>(
    'VIEW_RECORD_SCOPED',
    scopedSql,
    (db) => (db.prepare(scopedSql).get(userId, recordPublicId) as PublicRecord) || null,
    [userId, recordPublicId]
  );

  if (record) {
    return { record, existsGlobally: true };
  }

  // If not found in user scope, check if it exists globally to accurately return 403 Forbidden vs 404 Not Found
  const globalSql = `SELECT 1 FROM records WHERE public_id = ? LIMIT 1`;
  const globalCheck = trackedQuery<boolean>(
    'CHECK_GLOBAL_EXISTENCE',
    globalSql,
    (db) => Boolean(db.prepare(globalSql).get(recordPublicId)),
    [recordPublicId]
  );

  return { record: null, existsGlobally: globalCheck };
}

/**
 * Create a new record owned by the authenticated user.
 */
export function createRecord(userId: number, input: CreateRecordInput): PublicRecord {
  const publicId = generatePublicId('rec');
  const now = new Date().toISOString();

  const sql = `
    INSERT INTO records (public_id, user_id, title, category, content, amount_cents, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
  `;

  trackedQuery(
    'CREATE_RECORD',
    sql,
    (db) => {
      db.prepare(sql).run(
        publicId,
        userId,
        input.title.trim(),
        input.category.trim(),
        input.content.trim(),
        input.amount_cents || 0,
        now,
        now
      );
    },
    [publicId, userId, input.title, input.category, input.content, input.amount_cents, now, now]
  );

  return {
    public_id: publicId,
    title: input.title.trim(),
    category: input.category.trim(),
    content: input.content.trim(),
    amount_cents: input.amount_cents || 0,
    status: 'active',
    created_at: now,
    updated_at: now,
  };
}

/**
 * Atomic deletion with pre-delete audit log persistence.
 * If user does not own the record, throws an error distinguishing 403 (forbidden) vs 404 (not found).
 */
export function deleteScopedRecord(
  user: User,
  recordPublicId: string,
  meta: { ipAddress?: string | null; userAgent?: string | null }
): { success: boolean; auditPublicId: string } {
  const db = getDb();

  // Run inside a single ACID transaction
  const executeTransaction = db.transaction(() => {
    // 1. Fetch the record under strict user ownership
    const scopedFetchSql = `
      SELECT id, public_id, title, category, content, amount_cents, status, created_at
      FROM records
      WHERE user_id = ? AND public_id = ?
    `;
    const recordToDel = db.prepare(scopedFetchSql).get(user.id, recordPublicId) as
      | {
          id: number;
          public_id: string;
          title: string;
          category: string;
          content: string;
          amount_cents: number;
          status: string;
          created_at: string;
        }
      | undefined;

    if (!recordToDel) {
      // Check if record exists for another user to throw 403
      const globalCheck = db.prepare('SELECT user_id FROM records WHERE public_id = ?').get(recordPublicId) as { user_id: number } | undefined;
      if (globalCheck && globalCheck.user_id !== user.id) {
        const error = new Error('Forbidden: You do not have permission to delete this record');
        (error as unknown as { statusCode: number }).statusCode = 403;
        throw error;
      }
      const error = new Error('Record not found');
      (error as unknown as { statusCode: number }).statusCode = 404;
      throw error;
    }

    // 2. Persist audit log BEFORE deletion
    const auditPublicId = generatePublicId('aud');
    const auditInsertSql = `
      INSERT INTO audit_logs (
        public_id, user_id, user_email, record_public_id, record_title,
        action, metadata_json, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `;

    const snapshot = {
      title: recordToDel.title,
      category: recordToDel.category,
      amount_cents: recordToDel.amount_cents,
      original_created_at: recordToDel.created_at,
      deleted_by_user_id: user.public_id,
      deleted_by_email: user.email,
    };

    db.prepare(auditInsertSql).run(
      auditPublicId,
      user.id,
      user.email,
      recordToDel.public_id,
      recordToDel.title,
      'RECORD_DELETED',
      JSON.stringify(snapshot),
      meta.ipAddress || '127.0.0.1',
      meta.userAgent || 'API/Browser'
    );

    // 3. Delete the record scoped to the user
    const deleteSql = `DELETE FROM records WHERE user_id = ? AND public_id = ?`;
    db.prepare(deleteSql).run(user.id, recordPublicId);

    return auditPublicId;
  });

  const auditPublicId = trackedQuery(
    'DELETE_RECORD_TRANSACTION',
    'BEGIN TRANSACTION -> INSERT audit_logs -> DELETE records WHERE user_id = ? AND public_id = ? -> COMMIT',
    () => executeTransaction(),
    [user.id, recordPublicId]
  );

  return { success: true, auditPublicId };
}

/**
 * List audit logs for the authenticated user ONLY.
 * Scoped in the SQL itself so one tenant can never read another's audit trail.
 */
export function listAuditLogs(userId: number, limit = 50): AuditLogItem[] {
  const sql = `
    SELECT public_id, user_email, record_public_id, record_title, action, metadata_json, ip_address, user_agent, created_at
    FROM audit_logs
    WHERE user_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `;
  return trackedQuery<AuditLogItem[]>(
    'LIST_AUDIT_LOGS',
    sql,
    (db) => db.prepare(sql).all(userId, limit) as AuditLogItem[],
    [userId, limit]
  );
}
