import { NextResponse } from 'next/server';
import { ensureSeedUsers, getAllUsers } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Demo tenant list for the switcher (includes demo credentials).
export async function GET() {
  ensureSeedUsers();
  return NextResponse.json({ users: getAllUsers() });
}
