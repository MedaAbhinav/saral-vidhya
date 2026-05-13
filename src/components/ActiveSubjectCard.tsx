import type { SubjectId } from '@/data/studyTable';
import { SUBJECT_LABELS } from '@/data/studyTable';

interface ActiveSubjectCardProps {
  subject: SubjectId;
  progress: number;
  onStartPomodoro: () => void;
  subjectColor: string;
}

export default function ActiveSubjectCard({
  subject,
  progress,
  onStartPomodoro,
  subjectColor,
}: ActiveSubjectCardProps) {
  return (
    <div className="active-subject-card" style={{ '--subject-color': subjectColor } as React.CSSProperties}>
      <div className="active-subject-card-inner">
        <span className="active-subject-badge" style={{ backgroundColor: subjectColor }}>
          Current focus
        </span>
        <h2 className="active-subject-title">{SUBJECT_LABELS[subject]}</h2>
        <div className="active-subject-progress-wrap">
          <div className="active-subject-progress-bar">
            <div
              className="active-subject-progress-fill"
              style={{ width: `${progress}%`, backgroundColor: subjectColor }}
            />
          </div>
          <span className="active-subject-progress-label">{progress}% done</span>
        </div>
        <button type="button" className="btn-pomodoro" onClick={onStartPomodoro}>
          🍅 Pomodoro Timer
        </button>
      </div>
    </div>
  );
}
