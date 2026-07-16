import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { artifactItemId, itemIndex, itemType, response, isCorrect, timeSpentSeconds } = await request.json();

  try {
    const attempt = await db.attempt.create({
      data: {
        sessionId,
        artifactItemId,
        itemIndex,
        itemType,
        responseJson: JSON.stringify(response),
        isCorrect,
        timeSpentSeconds: timeSpentSeconds ?? null,
      },
    });

    return NextResponse.json(attempt, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to record attempt' }, { status: 500 });
  }
}
