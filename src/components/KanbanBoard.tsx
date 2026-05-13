import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useMemo, useState } from 'react';
import type { ColumnId, StudyTask } from '@/data/studyTable';
import { COLUMNS, SUBJECT_COLORS, SUBJECT_LABELS } from '@/data/studyTable';
import KanbanColumn from './KanbanColumn';

interface KanbanBoardProps {
  tasks: StudyTask[];
  onTasksChange: (tasks: StudyTask[]) => void;
  onTaskMovedToDone?: (task: StudyTask) => void;
}

function reorderTasks(tasks: StudyTask[], activeId: string, overColumnId: ColumnId): StudyTask[] {
  const active = tasks.find((t) => t.id === activeId);
  if (!active) return tasks;
  if (active.columnId === overColumnId) return tasks;
  return tasks.map((t) =>
    t.id === activeId ? { ...t, columnId: overColumnId, minutesLeft: overColumnId === 'in_progress' ? 25 : undefined } : t
  );
}

export default function KanbanBoard({ tasks, onTasksChange, onTaskMovedToDone }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const tasksByColumn = useMemo(() => {
    const map: Record<ColumnId, StudyTask[]> = { todo: [], in_progress: [], done: [] };
    tasks.forEach((t) => map[t.columnId].push(t));
    return map;
  }, [tasks]);

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(e.active.id as string);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const over = e.over;
    if (!over) return;
    let overColumnId: ColumnId | null = COLUMNS.some((c) => c.id === over.id) ? (over.id as ColumnId) : null;
    if (!overColumnId) {
      const overTask = tasks.find((t) => t.id === over.id);
      overColumnId = overTask ? overTask.columnId : null;
    }
    if (!overColumnId) return;
    const activeId = e.active.id as string;
    const activeTask = tasks.find((t) => t.id === activeId);
    if (!activeTask) return;
    const prevColumn = activeTask.columnId;
    const next = reorderTasks(tasks, activeId, overColumnId);
    onTasksChange(next);
    if (prevColumn !== 'done' && overColumnId === 'done' && onTaskMovedToDone) {
      onTaskMovedToDone({ ...activeTask, columnId: 'done' });
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="kanban-board">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            label={col.label}
            tasks={tasksByColumn[col.id]}
            subjectColors={SUBJECT_COLORS}
            subjectLabels={SUBJECT_LABELS}
            isOver={activeId !== null}
          />
        ))}
      </div>
    </DndContext>
  );
}
