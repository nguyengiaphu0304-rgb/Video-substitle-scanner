import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string; sessionId: string }> }) {
  const { sessionId } = await params;
  const { score, totalItems } = await request.json();

  if (typeof score !== 'number' || typeof totalItems !== 'number') {
    return NextResponse.json({ message: 'Invalid request data' }, { status: 400 });
  }

  try {
    const updatedSession = await db.studySession.update({
      where: { id: sessionId },
      data: {
        completedAt: new Date(),
        score,
        totalItems,
      },
    });

    return NextResponse.json(updatedSession);
  } catch (error) {
    return NextResponse.json({ message: 'Error completing session', error }, { status: 500 });
  }
}