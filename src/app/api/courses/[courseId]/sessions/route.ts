import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { artifactId, mode } = (await request.json()) as {
    artifactId?: unknown;
    mode?: unknown;
  };

  if (typeof artifactId !== 'string' || !artifactId.trim()) {
    return NextResponse.json({ error: 'Artifact ID is required' }, { status: 400 });
  }

  if (typeof mode !== 'string' || !mode.trim()) {
    return NextResponse.json({ error: 'Mode is required' }, { status: 400 });
  }

  try {
    const artifact = await db.studyArtifact.findFirst({
      where: { id: artifactId, courseId },
      select: { id: true },
    });

    if (!artifact) {
      return NextResponse.json({ error: 'Artifact not found for course' }, { status: 404 });
    }

    const session = await db.studySession.create({
      data: {
        courseId,
        artifactId,
        mode,
        startedAt: new Date(),
      },
    });
    return NextResponse.json(session, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}
