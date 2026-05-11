"use client";

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

const NewLecturePage = () => {
  const router = useRouter();
  const params = useParams();
  const courseId = params.courseId as string;

  const [lectureTitle, setLectureTitle] = useState('');
  const [lectureText, setLectureText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerateQuiz = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/courses/${courseId}/lecture-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lectureTitle, text: lectureText }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate quiz');
      }

      // Redirect to the newly created artifact or handle success
      router.push(`/courses/${courseId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>New Lecture</h1>
      <input
        type="text"
        placeholder="Lecture Title"
        value={lectureTitle}
        onChange={(e) => setLectureTitle(e.target.value)}
      />
      <textarea
        placeholder="Paste lecture content here..."
        value={lectureText}
        onChange={(e) => setLectureText(e.target.value)}
      />
      <button onClick={handleGenerateQuiz} disabled={loading}>
        {loading ? 'Generating...' : 'Generate Quiz'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default NewLecturePage;