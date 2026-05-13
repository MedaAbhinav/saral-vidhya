/**
 * Study Table / Today dashboard: tasks, deadlines, subject colors.
 */

export type ColumnId = 'todo' | 'in_progress' | 'done';

export const COLUMNS: { id: ColumnId; label: string }[] = [
  { id: 'todo', label: 'To-Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'done', label: 'Done' },
];

export type SubjectId = 'physics' | 'math' | 'biology' | 'history' | 'chemistry' | 'english';

export const SUBJECT_COLORS: Record<SubjectId, string> = {
  physics: '#2196f3',   // blue
  math: '#e53935',      // red
  biology: '#43a047',   // green
  history: '#8e24aa',   // purple
  chemistry: '#ff9800', // orange
  english: '#0097a7',   // teal
};

export const SUBJECT_LABELS: Record<SubjectId, string> = {
  physics: 'Physics',
  math: 'Math',
  biology: 'Biology',
  history: 'History',
  chemistry: 'Chemistry',
  english: 'English',
};

export interface StudyTask {
  id: string;
  subject: SubjectId;
  title: string;
  columnId: ColumnId;
  minutesLeft?: number; // for "In Progress" items
}

export interface Deadline {
  id: string;
  title: string;
  daysLeft: number;
  urgency: 'high' | 'medium' | 'low'; // 🔴 🟡 🟢
}

export const DEFAULT_TASKS: StudyTask[] = [
  { id: 't1', subject: 'physics', title: 'Review Chapter 5', columnId: 'todo' },
  { id: 't2', subject: 'history', title: 'Essay Outline', columnId: 'todo' },
  { id: 't3', subject: 'math', title: 'Linear Equations', columnId: 'in_progress', minutesLeft: 30 },
  { id: 't4', subject: 'biology', title: 'Cell Structure', columnId: 'done' },
];

export const DEFAULT_DEADLINES: Deadline[] = [
  { id: 'd1', title: 'Chemistry Test', daysLeft: 2, urgency: 'high' },
  { id: 'd2', title: 'English Homework', daysLeft: 5, urgency: 'medium' },
];

export const DEFAULT_ACTIVE_SUBJECT: SubjectId = 'math';
export const DEFAULT_ACTIVE_PROGRESS = 70;
