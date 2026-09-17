import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { listUserRecords, createRecord } from '@/lib/records';
import { z } from 'zod';

const createRecordSchema = z.object({
  title: z.string().min(1, 'Title is required').max(120, 'Title cannot exceed 120 characters'),
  category: z.string().min(1, 'Category is required').max(50),
  content: z.string().min(1, 'Content is required').max(5000),
  amount_cents: z.number().int().nonnegative('Amount must be non-negative').default(0),
});

export async function GET(req: NextRequest) {
  const user = authenticateRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized: Authentication required to access records' },
      { status: 401 }
    );
  }

  const records = listUserRecords(user.id);
  return NextResponse.json({
    data: records,
    count: records.length,
    authenticated_as: {
      public_id: user.public_id,
      email: user.email,
      name: user.name,
    },
  });
}

export async function POST(req: NextRequest) {
  const user = authenticateRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized: Authentication required to create a record' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const validated = createRecordSchema.parse(body);
    const newRecord = createRecord(user.id, validated);

    return NextResponse.json(
      {
        message: 'Record created successfully',
        data: newRecord,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation Error', details: err.errors },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: (err as Error).message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
