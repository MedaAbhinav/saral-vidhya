import { useEffect, useMemo, useRef, useState } from 'react';
import { getManifest, getResourceContent, type DifficultyLevel, type Manifest } from '@/data/contentRepository';
import { parseQuestionBankMarkdown, type QuestionBankEntry } from '@/utils/questionBankParser';
import { googleTtsSpeak, googleTtsStop, googleTtsPause, googleTtsResume } from '@/services/googleTtsService';
import MarkdownView from './MarkdownView';

interface QuestionBankViewProps {
  persona: DifficultyLevel;
  currentSubjectId?: string;
  currentChapterNumber?: number;
  /** Fired when the concatenated read-aloud source text changes (e.g. after Go / persona reload). */
  onReadAloudTextChange?: (text: string) => void;
  highlight?: { active: boolean; startWord: number; endWord: number };
}

const SUBJECT_LABEL_OVERRIDES: Record<string, string> = {
  pubadm_ur: 'Public Administration (Urdu)',
};

function formatSubjectLabel(subjectName: string, subjectId: string) {
  if (SUBJECT_LABEL_OVERRIDES[subjectId]) return SUBJECT_LABEL_OVERRIDES[subjectId];
  if (!subjectName) return subjectId.replace(/_/g, ' ');
  return subjectName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface QBankReadAloudToolbarProps {
  text: string;
  subjectId?: string;
  onPlay?: () => void;
  onHighlightChange?: (payload: { active: boolean; startWord: number; endWord: number }) => void;
}

function stripForTts(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

/** Read-aloud controls for question bank; lives in StudyTable header row next to title & personas. */
export function QBankReadAloudToolbar({ text, subjectId, onPlay, onHighlightChange }: QBankReadAloudToolbarProps) {
  const [playbackState, setPlaybackState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const playbackRef = useRef<'idle' | 'playing' | 'paused'>('idle');
  const cooldownRef = useRef(false);

  const setPlayback = (state: 'idle' | 'playing' | 'paused') => {
    playbackRef.current = state;
    setPlaybackState(state);
  };

  const handlePlayPause = () => {
    if (cooldownRef.current) return;
    cooldownRef.current = true;
    window.setTimeout(() => {
      cooldownRef.current = false;
    }, 300);

    if (playbackRef.current === 'playing') {
      googleTtsPause();
      setPlayback('paused');
      onHighlightChange?.({ active: false, startWord: -1, endWord: -1 });
      return;
    }

    if (playbackRef.current === 'paused') {
      googleTtsResume();
      setPlayback('playing');
      onHighlightChange?.({ active: true, startWord: 0, endWord: 2 }); // Placeholder for resume
      return;
    }

    const clean = stripForTts(text);
    if (!clean) {
      console.warn('QBankReadAloudToolbar: No text to read');
      cooldownRef.current = false;
      return;
    }
    onPlay?.();

    const ranges: { start: number; end: number }[] = [];
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(clean)) !== null) {
      ranges.push({ start: m.index, end: m.index + m[0].length });
    }

    const SUBJECT_LANG: Record<string, string> = {
      pubadm_ur: 'ur-PK',
      hindi: 'hi-IN',
      telugu: 'te-IN',
    };
    const lang = (subjectId && SUBJECT_LANG[subjectId]) || 'en-IN';

    googleTtsSpeak(
      clean,
      lang,
      () => {
        setPlayback('playing');
        onHighlightChange?.({ active: true, startWord: 0, endWord: 2 });
      },
      () => {
        setPlayback('idle');
        onHighlightChange?.({ active: false, startWord: -1, endWord: -1 });
      },
      (charIndex) => {
        if (!ranges.length) return;
        let idx = 0;
        for (let i = 0; i < ranges.length; i++) {
          if (charIndex <= ranges[i].end) {
            idx = i;
            break;
          }
          idx = i;
        }
        onHighlightChange?.({
          active: true,
          startWord: Math.max(0, idx),
          endWord: Math.min(ranges.length - 1, idx + 2),
        });
      }
    );
  };

  const handleStop = () => {
    googleTtsStop();
    setPlayback('idle');
    onHighlightChange?.({ active: false, startWord: -1, endWord: -1 });
  };

  useEffect(() => {
    return () => googleTtsStop();
  }, []);

  return (
    <div className="qbank-read-aloud-toolbar" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', minWidth: 0 }}>
      <div className="read-aloud-tool-pill read-aloud-tool-pill--transport" style={{ marginLeft: 'auto', flexShrink: 0 }}>
        <div className="read-aloud-play-cluster">
          <button
            type="button"
            onClick={handlePlayPause}
            className="read-aloud-play-btn"
            aria-label={playbackState === 'playing' ? 'Pause reading' : 'Read aloud'}
            data-label={playbackState === 'playing' ? 'Pause' : 'Read aloud'}
          >
            {playbackState === 'playing' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '2px' }}>
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {playbackState !== 'idle' && (
            <button
              type="button"
              onClick={handleStop}
              className="read-aloud-action-btn"
              aria-label="Stop reading"
              data-label="Stop reading"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h12v12H6z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function QuestionBankView({ 
  persona, 
  currentSubjectId, 
  currentChapterNumber, 
  onReadAloudTextChange,
  highlight
}: QuestionBankViewProps) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<Record<string, number[]>>({});
  const [appliedSubjects, setAppliedSubjects] = useState<string[]>([]);
  const [appliedChapters, setAppliedChapters] = useState<Record<string, number[]>>({});
  const [questions, setQuestions] = useState<QuestionBankEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const visibleSubjects = useMemo(() => {
    if (!manifest) return [];
    return manifest.subjects;
  }, [manifest]);

  useEffect(() => {
    getManifest().then((m) => setManifest(m)).catch(() => setManifest({ subjects: [], resourceTabs: [] }));
  }, []);

  useEffect(() => {
    if (!manifest) return;
    
    if (currentSubjectId && currentChapterNumber) {
      const subId = currentSubjectId;
      const chNum = currentChapterNumber;
      setSelectedSubjects([subId]);
      setSelectedChapters({ [subId]: [chNum] });
      setAppliedSubjects([subId]);
      setAppliedChapters({ [subId]: [chNum] });
      loadQuestions([subId], { [subId]: [chNum] });
      return;
    }
    
    const defaultSubjects = visibleSubjects.map((subject) => subject.id);
    const defaultChapters = visibleSubjects.reduce<Record<string, number[]>>((acc, subject) => {
      acc[subject.id] = subject.chapters.map((chapter) => chapter.number);
      return acc;
    }, {});
    setSelectedSubjects(defaultSubjects);
    setSelectedChapters(defaultChapters);
  }, [manifest, visibleSubjects, currentSubjectId, currentChapterNumber]);

  const selectedCount = useMemo(
    () => Object.values(appliedChapters).reduce((sum, list) => sum + list.length, 0),
    [appliedChapters],
  );

  const focusedMode = Boolean(currentSubjectId);
  const focusedSubject = useMemo(() => {
    if (!focusedMode) return null;
    return visibleSubjects.find((s) => s.id === currentSubjectId) ?? manifest?.subjects.find((s) => s.id === currentSubjectId) ?? null;
  }, [focusedMode, visibleSubjects, currentSubjectId, manifest]);

  const loadQuestions = async (subjectsToLoad: string[], chaptersToLoad: Record<string, number[]>) => {
    if (!manifest) return;
    setLoading(true);
    const requested: Promise<QuestionBankEntry[]>[] = [];

    for (const subjectId of subjectsToLoad) {
      const subject = visibleSubjects.find((s) => s.id === subjectId) ?? manifest.subjects.find((s) => s.id === subjectId);
      if (!subject) continue;
      const chapters = chaptersToLoad[subjectId] ?? [];
      if (chapters.length === 0) continue;
      for (const chapterNumber of chapters) {
        requested.push(
          getResourceContent(subjectId, chapterNumber, 'question_bank.md', persona)
            .then((markdown) => {
              if (!markdown || markdown.trim().length === 0 || markdown.includes('Content not available')) {
                return [];
              }
              return parseQuestionBankMarkdown(markdown, subjectId, subject.name, chapterNumber, subject.chapters.find((c) => c.number === chapterNumber)?.name ?? `Chapter ${chapterNumber}`);
            })
            .catch(() => []),
        );
      }
    }

    const results = (await Promise.all(requested)).flat();
    setQuestions(results);
    setLoading(false);
  };

  const toggleChapter = (subjectId: string, chapterNumber: number) => {
    setSelectedChapters((prev) => {
      const current = prev[subjectId] ?? [];
      const nextList = current.includes(chapterNumber)
        ? current.filter((n) => n !== chapterNumber)
        : [...current, chapterNumber];
      return { ...prev, [subjectId]: nextList };
    });
  };

  const toggleCardFlip = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const qbankContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlight?.active && qbankContainerRef.current) {
      const highlightedEl = qbankContainerRef.current.querySelector('.qbank-card--highlighted');
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlight]);

  const handleGo = () => {
    setAppliedSubjects(selectedSubjects);
    setAppliedChapters(selectedChapters);
    loadQuestions(selectedSubjects, selectedChapters);
  };

  const qbankReadText = useMemo(() => {
    return questions
      .map((entry, index) => `${index + 1}. ${entry.question}. Answer: ${entry.shortAnswer || entry.longAnswer || ''}`)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }, [questions]);

  useEffect(() => {
    onReadAloudTextChange?.(qbankReadText);
  }, [qbankReadText, onReadAloudTextChange]);

  if (!manifest) {
    return <div className="loading-state">Loading question bank…</div>;
  }

  return (
    <div className="qbank-root" ref={qbankContainerRef}>
      {focusedSubject ? (
        <div className="qbank-simple-selector">
          <div className="qbank-simple-chapter-row">
            {focusedSubject.chapters.map((chapter) => {
              const selected = (selectedChapters[focusedSubject.id] ?? []).includes(chapter.number);
              return (
                <button
                  key={`${focusedSubject.id}-${chapter.number}`}
                  onClick={() => toggleChapter(focusedSubject.id, chapter.number)}
                  className={`qbank-simple-chapter-pill ${selected ? 'active' : ''}`}
                >
                  {chapter.number}
                </button>
              );
            })}
          </div>
          <div className="qbank-go-row">
            <button type="button" className="qbank-go-btn qbank-go-btn--sm" onClick={handleGo} disabled={loading || (selectedChapters[focusedSubject.id] ?? []).length === 0}>
              {loading ? '…' : 'Go'}
            </button>
          </div>
        </div>
      ) : selectedSubjects.length > 0 ? (
        <div className="qbank-section">
          <div className="qbank-section-label">Chapter selection for chosen subjects</div>
          <div className="qbank-card-grid">
            {selectedSubjects.map((subjectId) => {
              const subject = visibleSubjects.find((s) => s.id === subjectId) ?? manifest.subjects.find((s) => s.id === subjectId);
              if (!subject) return null;
              const selectedChapterIds = selectedChapters[subjectId] ?? [];
              return (
                <div key={subject.id} className="qbank-card">
                  <div className="qbank-chip-row">
                    {subject.chapters.map((chapter) => {
                      const selected = selectedChapterIds.includes(chapter.number);
                      return (
                        <button
                          key={`${subject.id}-${chapter.number}`}
                          onClick={() => toggleChapter(subject.id, chapter.number)}
                          className={`qbank-chip ${selected ? 'selected' : ''}`}
                        >
                          {chapter.number}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="qbank-go-row">
            <button type="button" className="qbank-go-btn" onClick={handleGo} disabled={loading || selectedSubjects.length === 0}>
              {loading ? 'Loading...' : 'Go'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '24px', color: '#6B7280' }}>Select subjects to see chapters and load question bank content.</div>
      )}

      <div className="qbank-stats">
        <div className="qbank-stat-label">
          {questions.length} questions loaded from {selectedCount} chapter{selectedCount === 1 ? '' : 's'}
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Loading selected question bank content…</div>
      ) : questions.length === 0 && appliedSubjects.length > 0 ? (
        <div className="qbank-empty">
          No question bank entries were found for the selected subjects and chapters.
        </div>
      ) : questions.length === 0 ? (
        <div className="qbank-empty">
          Select chapters and click Go to load questions.
        </div>
      ) : (
        <div className="qbank-card-list">
          {questions.map((entry, index) => {
            const flipped = expandedCards[entry.id] ?? false;
            
            // Highlight logic
            // Each question block starts at a certain word index in the concatenated text
            // Concatenated text: "1. Q. Answer: A 2. Q. Answer: A ..."
            let questionStartWord = 0;
            for(let i=0; i<index; i++) {
              const prev = questions[i];
              const prevText = `${i + 1}. ${prev.question}. Answer: ${prev.shortAnswer || prev.longAnswer || ''}`;
              questionStartWord += prevText.trim().split(/\s+/).length;
            }
            
            const currentText = `${index + 1}. ${entry.question}. Answer: ${entry.shortAnswer || entry.longAnswer || ''}`;
            const questionWords = currentText.trim().split(/\s+/).length;
            const questionEndWord = questionStartWord + questionWords - 1;

            const isHighlighted = highlight?.active && 
                                 highlight.startWord >= questionStartWord && 
                                 highlight.startWord <= questionEndWord;

            return (
              <div key={entry.id} className={`qbank-simple-question-card ${isHighlighted ? 'qbank-card--highlighted' : ''}`}>
                <div className="qbank-question-meta qbank-question-meta-front">
                  Chapter {entry.chapterNumber}{entry.chapterName ? ` · ${entry.chapterName}` : ''}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div className="qbank-question-title" style={{ flex: 1, margin: 0 }}>
                    {index + 1}. <MarkdownView content={entry.question} />
                  </div>
                  {/* Always-visible icon to reveal/hide answer */}
                  <button
                    className="qbank-long-answer-icon"
                    type="button"
                    onClick={() => toggleCardFlip(entry.id)}
                    aria-label={flipped ? 'Hide long answer' : 'Show long answer'}
                    title={flipped ? 'Hide long answer' : 'Show long answer'}
                    style={{ marginTop: '2px', flexShrink: 0 }}
                  >
                    <svg
                      width="15" height="15" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transition: 'transform 0.2s', transform: flipped ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    >
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                </div>
                {/* Short answer — shown by default */}
                {(entry.shortAnswer) && (
                  <div className="qbank-question-answer qbank-question-answer-front" style={{ marginTop: '6px' }}>
                    <MarkdownView content={entry.shortAnswer} />
                  </div>
                )}
                {/* Long answer — only when expanded and different */}
                {flipped && entry.longAnswer && entry.longAnswer !== entry.shortAnswer && (
                  <div className="qbank-question-answer" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #ddd6fe', color: '#334155' }}>
                    <MarkdownView content={entry.longAnswer} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
