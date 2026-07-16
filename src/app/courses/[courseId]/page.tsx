"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchCourseDetails } from '@/lib/api';

const CoursePage = () => {
  const params = useParams();
  const courseId = params.courseId as string;
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (courseId) {
      const loadCourseDetails = async () => {
        try {
          const courseData = await fetchCourseDetails(courseId);
          setCourse(courseData);
        } catch {
          setError('Failed to load course details');
        } finally {
          setLoading(false);
        }
      };

      loadCourseDetails();
    }
  }, [courseId]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div>
      <h1>{course.title}</h1>
      <p>Institution: {course.institution}</p>
      <p>Term: {course.term}</p>
      <p>Exam Date: {course.examDate?.toString()}</p>
      <h2>Lecture Sets</h2>
      {/* Render lecture sets and artifacts here */}
    </div>
  );
};

export default CoursePage;
