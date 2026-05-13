import { useDroppable } from '@dnd-kit/core';
import type { ColumnId, StudyTask } from '@/data/studyTable';
import type { SubjectId } from '@/data/studyTable';
import KanbanCard from './KanbanCard';

interface KanbanColumnProps {
  id: ColumnId;
  label: string;
  tasks: StudyTask[];
  subjectColors: Record<SubjectId, string>;
  subjectLabels: Record<SubjectId, string>;
  isOver?: boolean;
}

export default function KanbanColumn({
  id,
  label,
  tasks,
  subjectColors,
  subjectLabels,
  isOver,
}: KanbanColumnProps) {
  const { setNodeRef, isOver: isOverThis } = useDroppable({ id });
  const active = isOverThis || isOver;

  return (
    <div
      ref={setNodeRef}
      className={`kanban-column kanban-column--${id} ${active ? 'kanban-column--over' : ''}`}
    >
      <h3 className="kanban-column-title">{label}</h3>
      <div className="kanban-column-cards">
        {tasks.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            subjectColor={subjectColors[task.subject]}
            subjectLabel={subjectLabels[task.subject]}
          />
        ))}
      </div>
    </div>
  );
}
