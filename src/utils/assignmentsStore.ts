/**
 * assignmentsStore.ts
 * Manages expert-assigned assignments for students, stored in localStorage.
 */

export interface Assignment {
  id: string;
  studentUsername: string;
  subjectId: string;
  subjectName: string;
  chapterNumber: number;
  chapterName: string;
  dueDate: string; // ISO date string
  notes: string;
  createdAt: string;
  status: 'pending' | 'completed';
}

const KEY = 'saral_assignments';

export function loadAssignments(): Assignment[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Assignment[];
  } catch { /* ignore */ }
  return [];
}

function saveAssignments(assignments: Assignment[]) {
  try { localStorage.setItem(KEY, JSON.stringify(assignments)); } catch { /* ignore */ }
}

export function addAssignment(a: Omit<Assignment, 'id' | 'createdAt' | 'status'>): Assignment {
  const assignments = loadAssignments();
  const newA: Assignment = {
    ...a,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  saveAssignments([...assignments, newA]);
  return newA;
}

export function deleteAssignment(id: string): boolean {
  const assignments = loadAssignments();
  const filtered = assignments.filter(a => a.id !== id);
  if (filtered.length === assignments.length) return false;
  saveAssignments(filtered);
  return true;
}

export function markAssignmentComplete(id: string): boolean {
  const assignments = loadAssignments();
  const idx = assignments.findIndex(a => a.id === id);
  if (idx === -1) return false;
  assignments[idx].status = 'completed';
  saveAssignments(assignments);
  return true;
}

export function getAssignmentsForStudent(username: string): Assignment[] {
  return loadAssignments().filter(a => a.studentUsername.toLowerCase() === username.toLowerCase());
}
