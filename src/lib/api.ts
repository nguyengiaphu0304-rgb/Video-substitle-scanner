export async function fetchArtifact(artifactId: string) {
  const res = await fetch(`/api/artifacts/${artifactId}`);
  if (!res.ok) {
    throw new Error('Failed to fetch artifact');
  }
  return res.json();
}

export async function fetchCourseDetails(courseId: string) {
  const res = await fetch(`/api/courses/${courseId}`);
  if (!res.ok) {
    throw new Error('Failed to fetch course details');
  }
  return res.json();
}