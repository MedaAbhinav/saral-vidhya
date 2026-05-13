/**
 * Content repository: loads manifest and resource files from generated_resources.
 * Mirrors Android ContentRepository logic for the student learning app.
 *
 * Resource structure:
 *   generated_resources/<subject>/chapter_XX/<file>            ← shared files
 *   generated_resources/<subject>/chapter_XX/<level>/<file>    ← leveled files
 */

const BASE = '/generated_resources';

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export const DIFFICULTY_LEVELS: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced'];

/** Files that are NOT level-specific — same content for all difficulty levels. */
export const SHARED_RESOURCE_FILES = new Set([
  'learning_path.md',
  'podcast_script.md',
  'youtube_links.md',
  'course_offerings.md',
  'mindmap.md',       // lives at chapter root only
  'detailed_view.md', // lives at chapter root only
]);

/** Files whose content differs per difficulty level. */
export const LEVELED_RESOURCE_FILES = new Set([
  'summary.md',
  'study_guide.md',
  'question_bank.md',
  'flashcards',  // special key — loaded from flashcards.json in the level subfolder
]);

export interface Chapter {
  number: number;
  name: string;
  completed?: string[];
  resourceCount?: number;
}

export interface Subject {
  id: string;
  name: string;
  chapters: Chapter[];
}

export interface Manifest {
  subjects: Subject[];
  resourceTabs: [string, string][];
}

export interface FlashCard {
  front: string;
  back: string;
}

export interface FlashCardSet {
  chapter: string;
  subject: string;
  flashcards: FlashCard[];
}

/** Display tabs — leveled tabs first, then shared. */
export const DEFAULT_RESOURCE_TABS: [string, string][] = [
  ['summary.md',        'Summary'],
  ['study_guide.md',    'Study Guide'],
  ['question_bank.md',  'Question Bank'],
  ['flashcards',        'Flashcards'],
  ['mindmap.md',        'Mindmap'],
  ['learning_path.md',  'Learning Path'],
  ['detailed_view.md',  'Detailed Notes'],
  ['podcast_script.md', 'Podcast Script'],
  ['youtube_links.md',  'YouTube Links'],
  ['course_offerings.md','Course Info'],
];

let cachedManifest: Manifest | null = null;

export async function getManifest(): Promise<Manifest> {
  if (cachedManifest) return cachedManifest;
  const res = await fetch(`${BASE}/manifest.json`);
  if (!res.ok) {
    return { subjects: [], resourceTabs: DEFAULT_RESOURCE_TABS };
  }
  const data = (await res.json()) as Manifest;
  cachedManifest = data;
  return data;
}

export function getChapters(manifest: Manifest, subjectId: string): Chapter[] {
  const subject = manifest.subjects.find((s) => s.id === subjectId);
  return subject?.chapters ?? [];
}

/**
 * Returns the URL for a resource file.
 * Shared files resolve to the chapter root; leveled files resolve to the
 * level sub-directory. Defaults to 'intermediate' when no level is specified.
 */
export function getResourceContentUrl(
  subject: string,
  chapterNumber: number,
  resourceName: string,
  level: DifficultyLevel = 'intermediate',
): string {
  const chDir = `chapter_${String(chapterNumber).padStart(2, '0')}`;
  const isShared = SHARED_RESOURCE_FILES.has(resourceName);
  if (isShared) {
    return `${BASE}/${subject}/${chDir}/${resourceName}`;
  }
  return `${BASE}/${subject}/${chDir}/${level}/${resourceName}`;
}

export async function getResourceContent(
  subject: string,
  chapterNumber: number,
  resourceName: string,
  level: DifficultyLevel = 'intermediate',
): Promise<string> {
  const chDir = `chapter_${String(chapterNumber).padStart(2, '0')}`;

  const tryFetch = async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) return null;
      // Vite dev server returns 200 + text/html for missing static files — detect and reject
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('text/html')) return null;
      return res.text();
    } catch {
      return null;
    }
  };

  // Try leveled path first, then chapter root
  const leveledResult = await tryFetch(`${BASE}/${subject}/${chDir}/${level}/${resourceName}`);
  if (leveledResult !== null) return leveledResult;

  const rootResult = await tryFetch(`${BASE}/${subject}/${chDir}/${resourceName}`);
  if (rootResult !== null) return rootResult;

  return `Content not available.`;
}


export async function getFlashcards(
  subject: string,
  chapterNumber: number,
  level: DifficultyLevel = 'intermediate',
): Promise<FlashCard[]> {
  const chDir = `chapter_${String(chapterNumber).padStart(2, '0')}`;
  // Try leveled path first, then fall back to chapter root
  const paths = [
    `${BASE}/${subject}/${chDir}/${level}/flashcards.json`,
    `${BASE}/${subject}/${chDir}/flashcards.json`,
  ];
  for (const url of paths) {
    const res = await fetch(url);
    if (res.ok) {
      const set: FlashCardSet = await res.json();
      if (set.flashcards?.length) return set.flashcards;
    }
  }
  return [{ front: 'Error', back: 'Could not load flashcards.' }];
}

export function getResourceTabs(manifest: Manifest): [string, string][] {
  return manifest.resourceTabs ?? DEFAULT_RESOURCE_TABS;
}
