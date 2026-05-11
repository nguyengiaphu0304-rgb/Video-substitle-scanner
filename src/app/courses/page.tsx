"use client";

import React, { useEffect, useState } from 'react';

const CoursesPage = () => {
  const [courses, setCourses] = useState<any[]>([]);
  const [courseTitle, setCourseTitle] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      const response = await fetch('/api/courses');
      const data = await response.json();
      setCourses(data);
      setLoading(false);
    };

    fetchCourses();
  }, []);

  const handleCreateCourse = async () => {
    if (!courseTitle) return;

    const response = await fetch('/api/courses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: courseTitle }),
    });

    if (response.ok) {
      const newCourse = await response.json();
      setCourses((prevCourses) => [...prevCourses, newCourse]);
      setCourseTitle('');
    }
  };

  return (
    <div>
      <h1>Manage Courses</h1>
      <input
        type="text"
        value={courseTitle}
        onChange={(e) => setCourseTitle(e.target.value)}
        placeholder="Enter course title"
      />
      <button onClick={handleCreateCourse}>Create Course</button>

      {loading ? (
        <p>Loading courses...</p>
      ) : (
        <ul>
          {courses.map((course) => (
            <li key={course.id}>
              <a href={`/courses/${course.id}`}>{course.title}</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CoursesPage;