import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ artifactId: string }> }) {
  const { artifactId } = await params;

  try {
    const artifact = await db.studyArtifact.findUnique({
      where: { id: artifactId },
      include: {
        artifactItems: true,
      },
    });

    if (!artifact) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }

    return NextResponse.json(artifact);
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
