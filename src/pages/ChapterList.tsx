import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { getManifest, getChapters, type Chapter } from '@/data/contentRepository';
import { getChapterToolCoveragePercent } from '@/utils/analytics';
import { getTopicsForChapter } from '@/data/chapterTopics';

const PUBADM_UR_ENABLED_COUNT = 1;

function SubjectHeaderIcon({ subjectId }: { subjectId: string }) {
  const id = (subjectId || '').toLowerCase();
  const common = { width: 36, height: 36, fill: 'none', stroke: 'currentColor', strokeWidth: 2 } as const;
  switch (id) {
    case 'english':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    case 'telugu':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
      );
    case 'hindi':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      );
    case 'science':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      );
    case 'math':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    case 'social':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2h2a2.5 2.5 0 002.5-2.5V14a2 2 0 012-2h.027M13.757 5.107A4.477 4.477 0 0012 5.05c-.179.01-.354.03-.523.062M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    default:
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
  }
}

const BOOK_COLORS = [
  { 
    cover: 'linear-gradient(135deg, #1A0B2E 0%, #91207A 50%, #E7469B 100%)',
    accent: '#E7469B',
    spine: '#4A1573', 
    text: '#FFFFFF', 
    page: '#FDF7FA',
    dark: '#4A113E'
  },
  { 
    cover: 'linear-gradient(135deg, #2E0B3F 0%, #742296 50%, #C546C4 100%)',
    accent: '#C546C4',
    spine: '#5E1D82', 
    text: '#FFFFFF', 
    page: '#FCF5FC',
    dark: '#3A114A'
  },
  { 
    cover: 'linear-gradient(135deg, #4A0D3E 0%, #A4225A 50%, #F27A8A 100%)',
    accent: '#F27A8A',
    spine: '#7A1848', 
    text: '#FFFFFF', 
    page: '#FEF6F7',
    dark: '#52102C'
  },
  { 
    cover: 'linear-gradient(135deg, #1A0B42 0%, #5E1D94 50%, #B73BA6 100%)',
    accent: '#B73BA6',
    spine: '#3D1063', 
    text: '#FFFFFF', 
    page: '#FAF6FC',
    dark: '#2F0E4A'
  },
];

export default function ChapterList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { subjectId } = useParams<{ subjectId: string }>();
  const treeLogoSrc = `${import.meta.env.BASE_URL}brand-tree-logo.png`;
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookOpen, setBookOpen] = useState(false);
  const [clickedChapter, setClickedChapter] = useState<number | null>(null);
  
  const [displayMode, setDisplayMode] = useState<'grid' | 'flip' | 'list'>('flip');
  const [flipIndex, setFlipIndex] = useState(0);
  const className   = searchParams.get('className')   || '';
  const sId         = subjectId || searchParams.get('sId')         || '';
  const subjectName = searchParams.get('subjectName') || '';

  useEffect(() => {
    if (!sId) return;
    const internalId = (sId === 'english' || sId === 'science') ? sId : 'english';
    getManifest().then((m) => {
      setChapters(getChapters(m, internalId));
      setLoading(false);
    });
  }, [sId]);

  // Trigger the book-open animation shortly after data loads
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setBookOpen(true), 80);
      return () => clearTimeout(t);
    }
  }, [loading]);

  const isDisabled = (ch: Chapter) =>
    sId === 'pubadm_ur' ? ch.number > PUBADM_UR_ENABLED_COUNT : false;

  const handleChapterClick = (ch: Chapter) => {
    if (isDisabled(ch)) return;
    setClickedChapter(ch.number);
    setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      params.set('chapter', ch.number.toString());
      params.set('chapterName', ch.name);
      params.delete('tool');
      navigate(`/study-table?${params.toString()}`);
    }, 800);
  };

  const renderBookCard = (ch: Chapter, idx: number, forceAnimationDelayZero = false) => {
    const disabled = isDisabled(ch);
    const col = BOOK_COLORS[idx % BOOK_COLORS.length];
    
    return (
      <div
        key={ch.number}
        className={`book-card ${disabled ? 'book-card--locked' : ''} ${bookOpen ? 'book-card--open' : ''} ${clickedChapter === ch.number ? 'book-card--clicked' : ''}`}
        style={{
          '--book-cover': col.cover,
          '--book-accent': col.accent,
          '--book-spine': col.spine,
          '--book-text': col.text,
          '--book-page-bg': col.page,
          '--book-dark': col.dark,
          animationDelay: forceAnimationDelayZero ? '0s' : (bookOpen && clickedChapter !== ch.number ? `${idx * 0.055}s` : '0s'),
          '--flip-dir': idx % 2 === 0 ? '-1' : '1',
        } as React.CSSProperties}
        onClick={() => handleChapterClick(ch)}
      >
        {/* Book spine */}
        <div className="book-card-spine">
        </div>

        {/* Book cover area (top portion with gradient) */}
        <div className="book-card-cover">
          <div className="book-cover-heading">
            <span className="book-cover-number">Chapter {ch.number}</span>
          </div>

          <div className="book-cover-lines">
            <div className="book-cover-line book-cover-line--lg"/>
            <div className="book-cover-line book-cover-line--sm"/>
            <div className="book-cover-line book-cover-line--md"/>
          </div>

          <div className="book-cover-ornament"/>
        </div>

        {/* Book page area (bottom, bright background) */}
        <div className="book-card-page">
          <h3
            className={`book-card-title ${sId === 'pubadm_ur' ? 'rtl' : ''}`}
            dir={sId === 'pubadm_ur' ? 'rtl' : undefined}
          >
            {ch.name}
          </h3>

          {disabled ? (
            <span className="book-card-locked">🔒 Coming Soon</span>
          ) : null}
        </div>

        {/* Subtle page-edge texture on the right */}
        <div className="book-card-pages-edge"/>

        {/* Fake page for opening animation */}
        {clickedChapter === ch.number && (
          <div className="book-card-flip-page">
            <div className="book-card-flip-page-inner">
              <div className="book-opening-content">
                <span className="book-opening-number">Chapter {ch.number}</span>
                <div className="book-opening-line" />
                <h4 className="book-opening-title">{ch.name}</h4>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="sv-app book-app sv-app--no-rail">

      <main className="sv-main book-main">

        {/* Frosted topbar */}
        <header className="sv-topbar">
          <div className="sv-topbar-left">
            <div className="sv-persona-brand-mark">
              <img
                className="sv-persona-tree-logo"
                src={treeLogoSrc}
                alt="Saral Vidhya"
                width={220}
                height={132}
              />
            </div>
            <div className="sv-breadcrumb">
                <span className="sv-bc-sep">/</span>
              <span className="sv-bc-link" onClick={() => navigate('/')}>{className || 'Class'}</span>
              <span className="sv-bc-sep">/</span>
              <span className="sv-bc-current">{subjectName || 'Subject'}</span>
            </div>
          </div>
          <div className="sv-topbar-right">
            <button className="sv-logout-btn" onClick={() => navigate('/')}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Logout
            </button>
            <button className="sv-profile-btn" onClick={() => navigate('/profile')}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile
            </button>
          </div>
        </header>

        {/* Book page content */}
        <div className="book-content">

          {loading ? (
            <div className="book-loading">
              <div className="book-loading-icon">
                <div className="book-loading-left"/>
                <div className="book-loading-spine"/>
                <div className="book-loading-right"/>
              </div>
              <p className="book-loading-text">Opening your book…</p>
            </div>
          ) : (
            <>
              {/* Page header */}
              <div className={`book-header ${bookOpen ? 'book-header--visible' : ''}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%' }}>
                <div className="book-header-left" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div className="book-icon-deco book-icon-deco--subject">
                    <SubjectHeaderIcon subjectId={sId} />
                  </div>
                  <div>
                    <h1 className="book-title">{subjectName}</h1>
                  </div>
                </div>
                
                {/* View Mode Toggle */}
                <div className="view-mode-toggle">
                  <button className={`mode-btn ${displayMode === 'grid' ? 'active' : ''}`} onClick={() => setDisplayMode('grid')} title="Grid View">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                  </button>
                  <button className={`mode-btn ${displayMode === 'flip' ? 'active' : ''}`} onClick={() => setDisplayMode('flip')} title="Flip View">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                  </button>
                  <button className={`mode-btn ${displayMode === 'list' ? 'active' : ''}`} onClick={() => setDisplayMode('list')} title="List View">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                  </button>
                </div>
              </div>

              {/* Grid Mode */}
              {displayMode === 'grid' && (
                <div className={`book-shelf ${bookOpen ? 'book-shelf--open' : ''}`}>
                  {chapters.map((ch, idx) => renderBookCard(ch, idx, false))}
                </div>
              )}

              {/* Flip Mode */}
              {displayMode === 'flip' && (() => {
                const flipCh = chapters[flipIndex];
                const topicList = flipCh ? getTopicsForChapter(sId, flipCh.number) : [];
                const denom = Math.max(topicList.length, 6);
                const chapterPct = flipCh ? getChapterToolCoveragePercent(sId, flipCh.number, denom) : 0;
                return (
                  <div className="flip-mode-stack fade-in">
                    <div className="flip-mode-container">
                      <button
                        className="flip-nav-btn"
                        disabled={flipIndex === 0}
                        onClick={() => setFlipIndex(prev => Math.max(0, prev - 1))}
                      >
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                      </button>

                      <div className="flip-card-wrapper" key={flipCh?.number ?? flipIndex}>
                        {flipCh && renderBookCard(flipCh, flipIndex, true)}
                      </div>

                      <button
                        className="flip-nav-btn"
                        disabled={flipIndex === chapters.length - 1}
                        onClick={() => setFlipIndex(prev => Math.min(chapters.length - 1, prev + 1))}
                      >
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                      </button>
                    </div>

                    {flipCh && (
                      <div className="chapter-flip-meta" key={`meta-${flipCh.number}`}>
                        <div className="chapter-progress-row" aria-label="Chapter engagement">
                          <div className="chapter-progress-track">
                            <div
                              className="chapter-progress-fill"
                              style={{ width: `${chapterPct}%` }}
                            />
                          </div>
                          <span className="chapter-progress-pct">{chapterPct}%</span>
                        </div>
                        <div className="chapter-topics-block" style={{ display: 'none' }}>
                          <div className="chapter-topics-heading">Topics in this chapter</div>
                          {topicList.length > 0 ? (
                            <ul className="chapter-topics-list">
                              {topicList.map((t) => (
                                <li key={t}>{t}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="chapter-topics-empty">Topic outline will appear here when available for this subject.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* List Mode */}
              {displayMode === 'list' && (
                <div className="list-mode-container fade-in">
                  <div className="list-mode-table">
                    <div className="list-mode-header">
                      <div className="list-col-num">No.</div>
                      <div className="list-col-name">Chapter Name</div>
                      <div className="list-col-action"></div>
                    </div>
                    {chapters.map((ch) => {
                       const disabled = isDisabled(ch);
                       return (
                        <div 
                          key={ch.number} 
                          className={`list-mode-row ${disabled ? 'disabled' : ''}`}
                          onClick={() => !disabled && handleChapterClick(ch)}
                        >
                          <div className="list-col-num">{ch.number}</div>
                          <div className="list-col-name">{ch.name}</div>
                          <div className="list-col-action">
                             {disabled ? (
                               <span className="list-badge-locked">Locked</span>
                             ) : (
                               <span className="list-badge-open">Open →</span>
                             )}
                          </div>
                        </div>
                       )
                    })}
                  </div>
                </div>
              )}

            </>
          )}
        </div>
      </main>
    </div>
  );
}
