import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  getManifest,
  getResourceTabs,
  getResourceContent,
  getFlashcards,
  SHARED_RESOURCE_FILES,
  DIFFICULTY_LEVELS,
  type DifficultyLevel,
} from '@/data/contentRepository';
import MarkdownView from '@/components/MarkdownView';
import MermaidView from '@/components/MermaidView';
import FlashcardsView from '@/components/FlashcardsView';

export default function ResourceTabs() {
  const { subjectId, chapterNumber } = useParams<{ subjectId: string; chapterNumber: string }>();
  const [searchParams] = useSearchParams();
  const initialTabFile = searchParams.get('tab');
  const initialLevelStr = searchParams.get('level');

  const [chapterName, setChapterName] = useState('');
  const [tabs, setTabs] = useState<[string, string][]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [level, setLevel] = useState<DifficultyLevel>(
    DIFFICULTY_LEVELS.includes(initialLevelStr as DifficultyLevel)
      ? (initialLevelStr as DifficultyLevel)
      : 'intermediate'
  );
  const [content, setContent] = useState<string | null>(null);
  const [flashcards, setFlashcards] = useState<{ front: string; back: string }[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const chNum  = chapterNumber ? parseInt(chapterNumber, 10) : 0;
  const subject = subjectId ?? 'english';

  // Load manifest + chapter name + tabs once
  useEffect(() => {
    if (!subjectId || !chapterNumber) return;
    getManifest().then((m) => {
      const resourceTabs = getResourceTabs(m);
      setTabs(resourceTabs);

      if (initialTabFile) {
        const index = resourceTabs.findIndex(([f]) => f === initialTabFile);
        if (index !== -1) setActiveTab(index);
      }

      const sub = m.subjects.find((s) => s.id === subjectId);
      const ch  = sub?.chapters.find((c) => c.number === chNum);
      setChapterName(ch?.name ?? `Chapter ${chNum}`);
      setLoading(false);
    });
  }, [subjectId, chapterNumber, chNum, initialTabFile]);

  // Fetch tab content whenever active tab or level changes
  const fetchContent = useCallback(() => {
    if (!subjectId || !chapterNumber || tabs.length === 0) return;
    const [file] = tabs[activeTab];
    setContent(null);
    setFlashcards(null);
    setError(null);

    if (file === 'flashcards') {
      getFlashcards(subject, chNum, level).then(setFlashcards);
    } else {
      getResourceContent(subject, chNum, file, level)
        .then(setContent)
        .catch((e) => setError(String(e)));
    }
  }, [subjectId, chapterNumber, chNum, tabs, activeTab, level, subject]);

  useEffect(fetchContent, [fetchContent]);

  if (loading) return <div className="page"><p>Loading…</p></div>;

  const [activeFile] = tabs[activeTab] ?? ['summary.md', 'Summary'];
  const isMindmap    = activeFile === 'mindmap.md' && content?.includes('```mermaid');
  const isShared     = SHARED_RESOURCE_FILES.has(activeFile);

  return (
    <div className="page resource-tabs">
      <div className="resource-tabs-header">
        <Link to={`/subjects/${subjectId}`} className="back-link">← Back to chapters</Link>
        <h1>{chapterName}</h1>
        <p className="subtitle">{subjectName(subject)} • Chapter {chNum}</p>
      </div>

      {/* ── Difficulty level selector ── */}
      <div className="level-selector" title={isShared ? 'This resource is the same for all levels' : undefined}>
        {DIFFICULTY_LEVELS.map((lvl) => (
          <button
            key={lvl}
            className={`level-pill ${lvl === level ? 'active' : ''} ${isShared ? 'dimmed' : ''}`}
            onClick={() => !isShared && setLevel(lvl)}
            aria-pressed={lvl === level}
            aria-disabled={isShared}
          >
            {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
          </button>
        ))}
        {isShared && (
          <span className="level-shared-note">Same for all levels</span>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="tabs-row">
        {tabs.map(([, label], i) => (
          <button
            key={i}
            className={`tab ${i === activeTab ? 'active' : ''}`}
            onClick={() => setActiveTab(i)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="tab-content">
        {error && <p className="error">{error}</p>}
        {activeFile === 'flashcards' && flashcards !== null && (
          <FlashcardsView cards={flashcards} />
        )}
        {activeFile !== 'flashcards' && content !== null && isMindmap && (
          <MermaidView content={content} />
        )}
        {activeFile !== 'flashcards' && content !== null && !isMindmap && (
          <MarkdownView content={content} />
        )}
        {activeFile !== 'flashcards' && content === null && !error && <p>Loading…</p>}
      </div>
    </div>
  );
}

function subjectName(id: string) {
  return id.charAt(0).toUpperCase() + id.slice(1);
}
