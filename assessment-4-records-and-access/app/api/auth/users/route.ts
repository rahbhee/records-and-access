import { NextResponse } from 'next/server';
import { ensureSeedUsers, getAllUsers } from '@/lib/auth';

export async function GET() {
  ensureSeedUsers();
  const users = getAllUsers();
  return NextResponse.json({
    users,
  });
}
