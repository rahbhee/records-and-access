import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { queryTracker } from '@/lib/query-tracker';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = authenticateRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const recentLogs = queryTracker.getRecentLogs(30);
  return NextResponse.json({ data: recentLogs, count: recentLogs.length });
}
