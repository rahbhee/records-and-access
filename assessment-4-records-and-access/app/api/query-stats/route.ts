import { NextResponse } from 'next/server';
import { queryTracker } from '@/lib/query-tracker';

export async function GET() {
  const recentLogs = queryTracker.getRecentLogs(30);
  return NextResponse.json({
    data: recentLogs,
    count: recentLogs.length,
  });
}
