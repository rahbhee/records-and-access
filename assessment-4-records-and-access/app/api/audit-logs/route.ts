import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { listAuditLogs } from '@/lib/records';

export async function GET(req: NextRequest) {
  const user = authenticateRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const logs = listAuditLogs(50);
  return NextResponse.json({
    data: logs,
    count: logs.length,
  });
}
