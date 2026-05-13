/**
 * analytics.ts
 * Lightweight localStorage-based learning analytics tracker.
 * Called from StudyTable whenever a student opens a chapter or uses a tool.
 */

export interface ChapterVisit {
  subjectId: string;
  subjectName: string;
  chapterNumber: number;
  chapterName: string;
  timestamp: string;
}

export interface ToolEvent {
  tool: string;
  subjectId: string;
  chapterNumber: number;
  chapterName: string;
  timestamp: string;
}

export interface QuizRecord {
  subjectId: string;
  subjectName: string;
  chapterNumber: number;
  chapterName: string;
  score: number;
  total: number;
  timestamp: string;
}

export interface PersonaChange {
  from: string;
  to: string;
  timestamp: string;
}

export interface AnalyticsData {
  chapterVisits: ChapterVisit[];
  toolEvents: ToolEvent[];
  quizRecords: QuizRecord[];
  personaHistory: PersonaChange[];
}

const KEY = 'saral_analytics';
const MAX_EVENTS = 500;

function load(): AnalyticsData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as AnalyticsData;
  } catch { /* ignore */ }
  return { chapterVisits: [], toolEvents: [], quizRecords: [], personaHistory: [] };
}

function save(data: AnalyticsData) {
  // Trim to avoid localStorage bloat
  data.chapterVisits = data.chapterVisits.slice(-MAX_EVENTS);
  data.toolEvents    = data.toolEvents.slice(-MAX_EVENTS);
  data.quizRecords   = data.quizRecords.slice(-MAX_EVENTS);
  data.personaHistory = data.personaHistory.slice(-100);
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

export function trackChapterVisit(visit: Omit<ChapterVisit, 'timestamp'>) {
  const data = load();
  data.chapterVisits.push({ ...visit, timestamp: new Date().toISOString() });
  save(data);
}

export function trackToolUsage(event: Omit<ToolEvent, 'timestamp'>) {
  const data = load();
  data.toolEvents.push({ ...event, timestamp: new Date().toISOString() });
  save(data);
}

export function trackQuiz(record: Omit<QuizRecord, 'timestamp'>) {
  const data = load();
  data.quizRecords.push({ ...record, timestamp: new Date().toISOString() });
  save(data);
}

export function trackPersonaChange(from: string, to: string) {
  if (from === to) return;
  const data = load();
  data.personaHistory.push({ from, to, timestamp: new Date().toISOString() });
  save(data);
}

export function getAnalytics(): AnalyticsData {
  return load();
}

export function getUniqueVisitedChaptersForSubject(subjectId: string) {
  const data = load();
  return new Set(
    data.chapterVisits
      .filter((visit) => visit.subjectId === subjectId)
      .map((visit) => visit.chapterNumber)
  ).size;
}

export function getUniqueVisitedChaptersOverall() {
  const data = load();
  return new Set(data.chapterVisits.map((visit) => `${visit.subjectId}_${visit.chapterNumber}`)).size;
}

/** Rough % for a chapter from distinct tools used in Study Table (capped at denom). */
export function getChapterToolCoveragePercent(
  subjectId: string,
  chapterNumber: number,
  denom: number,
): number {
  const data = load();
  const used = new Set(
    data.toolEvents
      .filter((e) => e.subjectId === subjectId && e.chapterNumber === chapterNumber)
      .map((e) => e.tool),
  ).size;
  const d = Math.max(1, denom);
  return Math.min(100, Math.round((used / d) * 100));
}

export function clearAnalytics() {
  localStorage.removeItem(KEY);
}
