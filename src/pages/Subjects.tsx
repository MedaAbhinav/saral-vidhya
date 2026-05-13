import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getManifest } from '@/data/contentRepository';

export default function Subjects() {
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getManifest().then((m) => {
      setSubjects(m.subjects.map((s) => ({ id: s.id, name: s.name })));
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="page"><p>Loading subjects…</p></div>;

  return (
    <div className="page subjects">
      <h1>Subjects</h1>
      <p className="subtitle">Choose a subject to view chapters</p>
      <div className="subject-cards">
        {subjects.map((s) => (
          <Link key={s.id} to={`/subjects/${s.id}`} className="card subject-card">
            <span className="subject-icon">{s.id === 'science' ? '🔬' : '📚'}</span>
            <h2>{s.name}</h2>
          </Link>
        ))}
      </div>
    </div>
  );
}
