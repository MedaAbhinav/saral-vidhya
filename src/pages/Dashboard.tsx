import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DEFAULT_TASKS,
  DEFAULT_DEADLINES,
  DEFAULT_ACTIVE_SUBJECT,
  DEFAULT_ACTIVE_PROGRESS,
  SUBJECT_COLORS,
  type StudyTask,
  type SubjectId,
} from '@/data/studyTable';
import { getResourceContent, DIFFICULTY_LEVELS, type DifficultyLevel } from '@/data/contentRepository';
import MarkdownView from '@/components/MarkdownView';
import KanbanBoard from '@/components/KanbanBoard';
import ActiveSubjectCard from '@/components/ActiveSubjectCard';
import PomodoroTimer from '@/components/PomodoroTimer';
import UpcomingDeadlines from '@/components/UpcomingDeadlines';
import Toast from '@/components/Toast';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const USER_NAME = 'Maya';

export default function Dashboard() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<StudyTask[]>(DEFAULT_TASKS);
  const [deadlines] = useState(DEFAULT_DEADLINES);
  const [activeSubject] = useState<SubjectId>(DEFAULT_ACTIVE_SUBJECT);
  const [activeProgress] = useState(DEFAULT_ACTIVE_PROGRESS);
  const [pomodoroOpen, setPomodoroOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New states for Landing Page redesign
  const [level, setLevel] = useState<DifficultyLevel>('intermediate');
  const [summary, setSummary] = useState<string | null>(null);

  const currentChapterSubject = 'science';
  const currentChapterNumber = 1;
  const currentChapterName = 'Chemical Reactions and Equations';

  useEffect(() => {
    getResourceContent(currentChapterSubject, currentChapterNumber, 'summary.md', level)
      .then(setSummary)
      .catch((e) => console.error(e));
  }, [level]);

  const handleTasksChange = useCallback((next: StudyTask[]) => setTasks(next), []);
  const handleTaskMovedToDone = useCallback((task: StudyTask) => {
    setToastMessage(`Task completed: ${task.title}`);
  }, []);

  return (
    <div className="page dashboard-today">
      {/* Top Bar */}
      <header className="dashboard-topbar">
        <div>
          <h1 className="dashboard-greeting">{getGreeting()}, {USER_NAME}!</h1>
          <p className="dashboard-subtitle">Your focus for today</p>
        </div>
        <div id="persona-selector" className="level-selector" style={{ marginBottom: 0 }}>
          {DIFFICULTY_LEVELS.map((lvl) => (
            <button
              key={lvl}
              className={`level-pill ${lvl === level ? 'active' : ''}`}
              onClick={() => setLevel(lvl)}
            >
              {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
            </button>
          ))}
        </div>
      </header>

      {/* Current Chapter & Topic Summary */}
      <section className="dashboard-section">
        <div className="card" style={{ marginBottom: '16px' }}>
          <h2 className="section-title" style={{ color: 'var(--text)', marginBottom: '12px' }}>
            Current Chapter: Science Chapter 1: {currentChapterName}
          </h2>
          <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '8px' }}>
            {summary ? <MarkdownView content={summary} /> : <p>Loading summary...</p>}
          </div>
        </div>

        {/* 16-Button Navigation Grid */}
        <div className="dashboard-grid">
          {[
            { id: 1, label: 'Class & Subject Selection', icon: '📚', path: '/subjects' },
            { id: 2, label: 'Persona Selection', icon: '👤', action: () => document.getElementById('persona-selector')?.scrollIntoView({ behavior: 'smooth' }) },
            { id: 3, label: 'Chapter & Topic Listing', icon: '📑', path: `/subjects/${currentChapterSubject}` },
            { id: 4, label: 'Mindmaps', icon: '🧠', path: `/subjects/${currentChapterSubject}/chapter/${currentChapterNumber}?tab=mindmap.md&level=${level}` },
            { id: 5, label: 'Study Table', icon: '📅', action: () => document.getElementById('study-table')?.scrollIntoView({ behavior: 'smooth' }) },
            { id: 6, label: 'Flashcards', icon: '🃏', path: `/subjects/${currentChapterSubject}/chapter/${currentChapterNumber}?tab=flashcards&level=${level}` },
            { id: 8, label: 'Quiz', icon: '⚡', path: `/subjects/${currentChapterSubject}/chapter/${currentChapterNumber}?tab=pop_quiz.md&level=${level}` },
            { id: 9, label: 'Podcasts', icon: '🎙️', path: `/subjects/${currentChapterSubject}/chapter/${currentChapterNumber}?tab=podcast.md&level=${level}` },
            { id: 10, label: 'Videos', icon: '🎥', path: `/subjects/${currentChapterSubject}/chapter/${currentChapterNumber}?tab=yt.md&level=${level}` },
            { id: 11, label: 'Question Bank', icon: '🏦', path: `/subjects/${currentChapterSubject}/chapter/${currentChapterNumber}?tab=question_bank.md&level=${level}` },
            { id: 12, label: 'Prev. Year Papers', icon: '📄', path: `/subjects/${currentChapterSubject}/chapter/${currentChapterNumber}?tab=pyq.md&level=${level}` },
            { id: 13, label: 'Leader Board', icon: '🏆', yellow: true, action: () => setToastMessage('Leader Board coming soon!') },
            { id: 14, label: 'SWOT Analysis', icon: '📈', yellow: true, action: () => setToastMessage('SWOT Analysis coming soon!') },
            { id: 15, label: 'Progress Report', icon: '📊', yellow: true, action: () => setToastMessage('Progress Report coming soon!') },
            { id: 16, label: 'My Profile', icon: '🧑‍🎓', yellow: true, action: () => setToastMessage('Profile section coming soon!') },
          ].map((item) => (
            <div
              key={item.id}
              className={`dashboard-action-card ${item.yellow ? 'yellow' : ''}`}
              onClick={() => {
                if (item.path) navigate(item.path);
                else if (item.action) item.action();
              }}
            >
              <span className="card-icon">{item.icon}</span>
              <span className="card-label">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Today's Focus — Kanban */}
      <section id="study-table" className="dashboard-section">
        <h2 className="dashboard-section-title">Today&apos;s focus</h2>
        <KanbanBoard
          tasks={tasks}
          onTasksChange={handleTasksChange}
          onTaskMovedToDone={handleTaskMovedToDone}
        />
      </section>

      {/* Active Subject Card */}
      <section className="dashboard-section">
        <ActiveSubjectCard
          subject={activeSubject}
          progress={activeProgress}
          subjectColor={SUBJECT_COLORS[activeSubject]}
          onStartPomodoro={() => setPomodoroOpen(true)}
        />
      </section>

      {/* Upcoming Deadlines */}
      <section className="dashboard-section">
        <UpcomingDeadlines deadlines={deadlines} />
      </section>

      <PomodoroTimer isOpen={pomodoroOpen} onClose={() => setPomodoroOpen(false)} />
      <Toast
        message={toastMessage ?? ''}
        visible={toastMessage !== null}
        onDismiss={() => setToastMessage(null)}
      />
    </div>
  );
}
