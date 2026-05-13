import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { StudyTask } from '@/data/studyTable';

interface KanbanCardProps {
  task: StudyTask;
  subjectColor: string;
  subjectLabel: string;
}

export default function KanbanCard({ task, subjectColor, subjectLabel }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`kanban-card ${isDragging ? 'kanban-card--dragging' : ''}`}
      {...listeners}
      {...attributes}
    >
      <span className="kanban-card-accent" style={{ backgroundColor: subjectColor }} />
      <div className="kanban-card-body">
        <span className="kanban-card-subject" style={{ color: subjectColor }}>
          {subjectLabel}
        </span>
        <span className="kanban-card-title">{task.title}</span>
        {task.minutesLeft != null && task.columnId === 'in_progress' && (
          <span className="kanban-card-meta">{task.minutesLeft} mins left</span>
        )}
      </div>
    </div>
  );
}
