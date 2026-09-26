import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth';

export async function GET(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const records = await prisma.record.findMany({ where: { ownerId: user.id } });
  return NextResponse.json({ data: records });
}

export async function POST(request: Request) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const newRecord = await prisma.record.create({
    data: {
      public_id: `rec_${crypto.randomUUID()}`,
      title: body.title,
      category: body.category,
      content: body.content,
      amount_cents: body.amount_cents,
      ownerId: user.id,
    },
  });

  // Create audit log for creation
  await prisma.auditLog.create({
    data: {
      public_id: `log_${crypto.randomUUID()}`,
      user_email: user.email,
      record_public_id: newRecord.public_id,
      record_title: newRecord.title,
      action: 'CREATE',
      metadata_json: body,
      userId: user.id,
    },
  });

  return NextResponse.json({ data: newRecord }, { status: 201 });
}
