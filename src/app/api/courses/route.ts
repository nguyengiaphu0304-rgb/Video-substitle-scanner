import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const courses = await db.course.findMany();
    return NextResponse.json(courses);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to retrieve courses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { title, institution, term, examDate } = await request.json();

  try {
    const course = await db.course.create({
      data: {
        title,
        institution: institution ?? null,
        term: term ?? null,
        examDate: examDate ? new Date(examDate) : null,
      },
    });
    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create course' }, { status: 500 });
  }
}