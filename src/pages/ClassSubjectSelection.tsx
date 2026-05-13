import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUniqueVisitedChaptersForSubject } from '@/utils/analytics';

const CLASSES = [
  { id: '10', name: '10th Class', disabled: false },
];

const SEMESTERS_MAP: Record<string, { id: string, name: string, disabled?: boolean }[]> = {
  'ma': [
    { id: 'ma3', name: 'Semester 3', disabled: false },
  ]
};

// High-fidelity static cards configuration
const STATIC_SUBJECTS = [
  {
    id: 'english',
    name: 'English',
    active: true,
    totalChapters: 10,
    readChapters: 5,
    gradient: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
    glow: 'rgba(139, 92, 246, 0.15)',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    )
  },
  {
    id: 'telugu',
    name: 'Telugu',
    active: false,
    totalChapters: 8,
    readChapters: 0,
    gradient: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
    glow: 'rgba(139, 92, 246, 0.15)',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
    )
  },
  {
    id: 'hindi',
    name: 'Hindi',
    active: false,
    totalChapters: 10,
    readChapters: 0,
    gradient: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
    glow: 'rgba(139, 92, 246, 0.15)',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    )
  },
  {
    id: 'science',
    name: 'Science',
    active: true,
    totalChapters: 12,
    readChapters: 8,
    gradient: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
    glow: 'rgba(139, 92, 246, 0.15)',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    )
  },
  {
    id: 'math',
    name: 'Mathematics',
    active: false,
    totalChapters: 15,
    readChapters: 0,
    gradient: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
    glow: 'rgba(139, 92, 246, 0.15)',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    id: 'social',
    name: 'Social Studies',
    active: false,
    totalChapters: 8,
    readChapters: 0,
    gradient: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
    glow: 'rgba(139, 92, 246, 0.15)',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2h2a2.5 2.5 0 002.5-2.5V14a2 2 0 012-2h.027M13.757 5.107A4.477 4.477 0 0012 5.05c-.179.01-.354.03-.523.062M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
];

import ResumePodcastToast from '@/components/ResumePodcastToast';

export default function ClassSubjectSelection() {
  const navigate = useNavigate();
  const treeLogoSrc = `${import.meta.env.BASE_URL}brand-logo.png`;
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<string | null>(null);

  const defaultClassId = CLASSES.length === 1 ? CLASSES[0].id : null;
  const activeClassId = selectedClass || defaultClassId;
  const hasSemesters = activeClassId && SEMESTERS_MAP[activeClassId];

  // Step 0: pick class | Step 1: pick semester | Step 2: pick subject
  const step = !selectedClass ? 0 : (hasSemesters && !selectedSemester) ? 1 : 2;

  const handleClassClick = (classId: string, disabled: boolean) => {
    if (disabled) return;
    setSelectedClass(classId);
    setSelectedSemester(null);
  };

  const handleSemesterClick = (semesterId: string, disabled: boolean) => {
    if (disabled) return;
    setSelectedSemester(semesterId);
  };

  const handleSubjectClick = (subjectId: string, subjectName: string, disabled?: boolean) => {
    if (disabled || !activeClassId) return;

    const clName = CLASSES.find(c => c.id === activeClassId)?.name || activeClassId;
    let finalClassName = clName;
    if (hasSemesters && selectedSemester) {
      const semName = SEMESTERS_MAP[activeClassId].find(s => s.id === selectedSemester)?.name;
      finalClassName = `${clName} - ${semName}`;
    }
    const catalogId = hasSemesters ? selectedSemester || activeClassId : activeClassId;

    const baseParams = `cId=${catalogId}&className=${encodeURIComponent(finalClassName)}&sId=${subjectId}&subjectName=${encodeURIComponent(subjectName)}`;

    navigate(`/persona?${baseParams}`);
  };

  const selectedClassName = CLASSES.find(c => c.id === selectedClass)?.name;

  const handleBackToClass = () => {
    setSelectedClass(null);
    setSelectedSemester(null);
  };

  const logout = () => {
    localStorage.removeItem('app_authenticated');
    localStorage.removeItem('app_role');
    localStorage.removeItem('app_user_id');
    localStorage.removeItem('username');
    navigate('/login', { replace: true });
  };

  return (
    <div className="sv-app sv-class-landing sv-app--no-rail">
      <ResumePodcastToast />

      {/* ── MAIN PANEL ── */}
      <main className="sv-main">

        {/* Top bar */}
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
            {step > 0 && (
              <div className="sv-breadcrumb">
                <span className="sv-bc-sep">/</span>
                <span
                  className="sv-bc-link"
                  onClick={handleBackToClass}
                >{CLASSES.find(c => c.id === selectedClass)?.name}</span>
                {step === 2 && (
                  <>
                    <span className="sv-bc-sep">/</span>
                    <span className="sv-bc-current">Subjects</span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="sv-topbar-right">
            <button className="sv-logout-btn" onClick={logout}>
              Log Out
            </button>
            <button className="sv-profile-btn" onClick={() => navigate('/profile')}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="sv-content">

          {/* STEP 0 — Class Selection */}
          {step === 0 && (
            <div className="sv-hero sv-hero--class-only fade-in">
              <div className="sv-class-grid sv-class-grid--solo">
                {CLASSES.map((c) => (
                  <div
                    key={c.id}
                    className={`sv-class-card sv-class-card--large ${c.disabled ? 'sv-class-card--locked' : ''}`}
                    onClick={() => handleClassClick(c.id, c.disabled)}
                  >
                    <span className="sv-class-icon">🏫</span>
                    <span className="sv-class-name">{c.name}</span>
                    {c.disabled && <span className="sv-class-badge">Coming Soon</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 1 — Semester Selection */}
          {step === 1 && hasSemesters && selectedClass && (
            <div className="sv-hero fade-in">
              <div className="sv-hero-text">
                <h1 className="sv-hero-title">Choose your Semester</h1>
                <p className="sv-hero-sub">Select the semester for {selectedClassName}</p>
              </div>
              <div className="sv-class-grid">
                {SEMESTERS_MAP[selectedClass].map(s => (
                  <div
                    key={s.id}
                    className={`sv-class-card ${s.disabled ? 'sv-class-card--locked' : ''}`}
                    onClick={() => handleSemesterClick(s.id, s.disabled || false)}
                  >
                    <span className="sv-class-icon">📆</span>
                    <span className="sv-class-name">{s.name}</span>
                    {s.disabled && <span className="sv-class-badge">Coming Soon</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2 — Subject Cards */}
          {step === 2 && (
            <div className="sv-subjects fade-in">
              <div className="sv-subjects-header">
                <div>
                  <h2 className="sv-subjects-title">My Subjects</h2>
                </div>
              </div>

              <div className="sv-subjects-grid">
                {STATIC_SUBJECTS.map((s, idx) => {
                  const visited = getUniqueVisitedChaptersForSubject(s.id);
                  const coverage = Math.round((visited / s.totalChapters) * 100);

                  return (
                    <div
                      key={s.id}
                      className={`sv-subject-card ${!s.active ? 'sv-subject-card--locked' : ''}`}
                      style={{
                        '--card-gradient': s.gradient,
                        '--card-glow': s.glow,
                        animationDelay: `${idx * 0.07}s`
                      } as React.CSSProperties}
                      onClick={() => {
                        if (s.active) handleSubjectClick(s.id, s.name);
                        else alert(`${s.name} modules are being prepared. Stay tuned! 🚀`);
                      }}
                    >
                      {/* Gradient corner accent */}
                      <div className="sv-card-accent" />

                      {/* Icon block */}
                      <div className="sv-card-icon">
                        {s.icon}
                      </div>

                      {/* Body */}
                      <div className="sv-card-body">
                        <h3 className="sv-card-title">{s.name}</h3>
                        <div className="sv-progress-wrapper">
                          <div className="sv-progress-segments">
                            {Array.from({ length: s.totalChapters }).map((_, i) => (
                              <div
                                key={i}
                                className={`sv-progress-segment ${i < visited ? 'filled' : ''}`}
                              />
                            ))}
                          </div>
                          <div className="sv-progress-meta">
                            <span className="sv-progress-percent">{coverage}%</span>
                            <span className="sv-progress-count">{visited}/{s.totalChapters}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}


