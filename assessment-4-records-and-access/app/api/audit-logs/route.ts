import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { listAuditLogs } from '@/lib/records';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = authenticateRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Scoped to the caller: a tenant only ever sees their own audit trail.
  const logs = listAuditLogs(user.id, 50);
  return NextResponse.json({ data: logs, count: logs.length });
}
