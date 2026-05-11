import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { generateQuizFromSourceBlocks } from '@/modules/ai/generate-quiz';

export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { lectureSetId, count } = await request.json();

  if (!lectureSetId) {
    return NextResponse.json({ message: 'Lecture Set ID is required' }, { status: 400 });
  }

  try {
    const lectureSet = await db.lectureSet.findFirst({
      where: { id: lectureSetId, courseId },
      include: {
        sourceFiles: {
          include: {
            sourceBlocks: {
              orderBy: { blockIndex: 'asc' },
            },
          },
        },
      },
    });

    if (!lectureSet) {
      return NextResponse.json({ message: 'Lecture set not found' }, { status: 404 });
    }

    const sourceBlocks = lectureSet.sourceFiles.flatMap((file: any) => file.sourceBlocks);
    const quizItems = await generateQuizFromSourceBlocks({
      lectureTitle: lectureSet.title,
      sourceBlocks: sourceBlocks.map((block: any) => ({
        blockIndex: block.blockIndex,
        text: block.text,
      })),
      count: count || 8,
    });

    const artifact = await db.studyArtifact.create({
      data: {
        courseId,
        lectureSetId: lectureSet.id,
        artifactType: 'QUIZ',
        status: 'READY',
        inputScopeJson: JSON.stringify({ lectureSetId: lectureSet.id, count: quizItems.length }),
        contentJson: JSON.stringify(quizItems),
      },
    });

    await db.artifactItem.createMany({
      data: quizItems.map((item, index) => ({
        artifactId: artifact.id,
        itemIndex: index,
        itemType: 'QUIZ',
        prompt: item.question,
        answerKeyJson: JSON.stringify({ correct: item.correct }),
        explanation: item.explanation,
        sourceAnchorJson: JSON.stringify({
          fileId: lectureSet.sourceFiles[0]?.id || null,
          blockIndex: item.sourceBlockIndex,
        }),
        contentJson: JSON.stringify(item),
      })),
    });

    return NextResponse.json({ artifact, quizItems }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'Internal server error', error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}