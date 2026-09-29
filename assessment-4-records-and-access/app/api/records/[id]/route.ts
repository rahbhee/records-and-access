import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { getScopedRecord, deleteScopedRecord } from '@/lib/records';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = authenticateRequest(req);

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized: Authentication required to view this record' },
      { status: 401 }
    );
  }

  // Pre-fetch query scoping: SQL filters strictly by (user_id, public_id)
  const { record, existsGlobally } = getScopedRecord(user.id, id);

  if (!record) {
    if (existsGlobally) {
      return NextResponse.json(
        {
          error: 'Forbidden: You do not have permission to access this record',
          code: 'ACCESS_DENIED_NOT_OWNER',
        },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'Record not found', code: 'RECORD_NOT_FOUND' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: record,
    authenticated_as: { public_id: user.public_id, email: user.email },
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = authenticateRequest(req);

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized: Authentication required to delete records' },
      { status: 401 }
    );
  }

  try {
    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    const result = deleteScopedRecord(user, id, { ipAddress, userAgent });

    return NextResponse.json({
      message: 'Record deleted successfully and audit trail logged',
      audit_public_id: result.auditPublicId,
      record_public_id: id,
    });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    const statusCode = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || 'Failed to delete record' },
      { status: statusCode }
    );
  }
}
