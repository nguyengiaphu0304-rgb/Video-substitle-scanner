import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { chunkLectureText } from '@/modules/source-blocks/chunk';

export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { lectureTitle, text } = await request.json();

  if (!lectureTitle || !text) {
    return NextResponse.json({ error: 'Lecture title and text are required' }, { status: 400 });
  }

  try {
    const lectureSet = await db.lectureSet.create({
      data: {
        courseId,
        title: lectureTitle,
        status: 'READY',
      },
    });

    const sourceFile = await db.sourceFile.create({
      data: {
        lectureSetId: lectureSet.id,
        originalName: 'Pasted Lecture Text',
        mimeType: 'text/plain',
        extractedText: text,
        extractionStatus: 'READY',
      },
    });

    const blocks = chunkLectureText(text);

    if (blocks.length) {
      await db.sourceBlock.createMany({
        data: blocks.map((block, index) => ({
          sourceFileId: sourceFile.id,
          blockIndex: index,
          text: block,
          charCount: block.length,
        })),
      });
    }

    return NextResponse.json({ lectureSet, sourceFile, sourceBlocksCreated: blocks.length }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to ingest lecture text' }, { status: 500 });
  }
}
