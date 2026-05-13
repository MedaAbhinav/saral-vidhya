import type { Deadline } from '@/data/studyTable';

interface UpcomingDeadlinesProps {
  deadlines: Deadline[];
}

const URGENCY_ICON: Record<Deadline['urgency'], string> = {
  high: '🔴',
  medium: '🟡',
  low: '🟢',
};

export default function UpcomingDeadlines({ deadlines }: UpcomingDeadlinesProps) {
  if (deadlines.length === 0) return null;

  return (
    <section className="upcoming-deadlines">
      <h3 className="upcoming-deadlines-title">Upcoming deadlines</h3>
      <ul className="upcoming-deadlines-list">
        {deadlines.map((d) => (
          <li key={d.id} className={`upcoming-deadlines-item upcoming-deadlines-item--${d.urgency}`}>
            <span className="upcoming-deadlines-icon">{URGENCY_ICON[d.urgency]}</span>
            <span className="upcoming-deadlines-text">
              {d.title} — {d.daysLeft} day{d.daysLeft !== 1 ? 's' : ''} left
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
