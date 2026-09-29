import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth';
import { createRecord, listUserRecords } from '@/lib/records';

export const dynamic = 'force-dynamic';

const createRecordSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  category: z.string().trim().min(1, 'Category is required').max(100),
  content: z.string().trim().min(1, 'Content is required').max(5000),
  amount_cents: z.number().int().min(0).max(1_000_000_000_000).default(0),
});

export async function GET(req: NextRequest) {
  const user = authenticateRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const records = listUserRecords(user.id);
  return NextResponse.json({ data: records, count: records.length });
}

export async function POST(req: NextRequest) {
  const user = authenticateRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createRecordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // The owner always comes from the authenticated user, never from the body.
  const record = createRecord(user.id, parsed.data);
  return NextResponse.json({ data: record }, { status: 201 });
}
