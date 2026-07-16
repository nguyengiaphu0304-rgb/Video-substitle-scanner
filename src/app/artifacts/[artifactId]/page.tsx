"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchArtifact } from '@/lib/api';

const ArtifactPage = () => {
  const params = useParams();
  const artifactId = params.artifactId as string;
  const [artifact, setArtifact] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (artifactId) {
      const loadArtifact = async () => {
        try {
          const data = await fetchArtifact(artifactId);
          setArtifact(data);
        } catch {
          setError('Failed to load artifact');
        } finally {
          setLoading(false);
        }
      };

      loadArtifact();
    }
  }, [artifactId]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;
  if (!artifact) return <div>No artifact found.</div>;

  return (
    <div>
      <h1>{artifact.title}</h1>
      <div>
        {artifact.artifactItems?.map((item: any, index: number) => (
          <div key={index}>
            <h2>{item.question}</h2>
            {/* Render options and other details here */}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ArtifactPage;
