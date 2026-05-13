/**
 * credentialsStore.ts
 * Manages login credentials stored in localStorage.
 * Default accounts are seeded on first load.
 */

export type Role = 'student' | 'expert';

export interface Credential {
  id: string;
  username: string;
  password: string;
  role: Role;
  createdAt: string;
  persona?: string; // per-student difficulty level
}

const KEY = 'saral_credentials';

const DEFAULTS: Credential[] = [
  { id: '1', username: 'saralvidhya', password: 'Ekam@2026', role: 'student', createdAt: new Date().toISOString() },
  // expert account kept in code — add back when expert mode is re-enabled
  // { id: '2', username: 'expert', password: 'expert@123', role: 'expert', createdAt: new Date().toISOString() },
];

export function loadCredentials(): Credential[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Credential[];
  } catch { /* ignore */ }
  // First run — seed defaults
  saveCredentials(DEFAULTS);
  return DEFAULTS;
}

export function saveCredentials(creds: Credential[]) {
  try { localStorage.setItem(KEY, JSON.stringify(creds)); } catch { /* ignore */ }
}

export function findCredential(username: string, password: string): Credential | null {
  const creds = loadCredentials();
  return creds.find(c => c.username.toLowerCase() === username.toLowerCase() && c.password === password) ?? null;
}

export function addCredential(username: string, password: string, role: Role): Credential | { error: string } {
  const creds = loadCredentials();
  if (creds.find(c => c.username.toLowerCase() === username.toLowerCase())) {
    return { error: 'Username already exists.' };
  }
  const newCred: Credential = {
    id: Date.now().toString(),
    username: username.trim(),
    password,
    role,
    createdAt: new Date().toISOString(),
  };
  saveCredentials([...creds, newCred]);
  return newCred;
}

export function updateCredential(id: string, updates: Partial<Pick<Credential, 'password' | 'role'>>): boolean {
  const creds = loadCredentials();
  const idx = creds.findIndex(c => c.id === id);
  if (idx === -1) return false;
  creds[idx] = { ...creds[idx], ...updates };
  saveCredentials(creds);
  return true;
}

export function deleteCredential(id: string): boolean {
  const creds = loadCredentials();
  const filtered = creds.filter(c => c.id !== id);
  if (filtered.length === creds.length) return false;
  saveCredentials(filtered);
  return true;
}

/** Get a student's persona level. Falls back to 'intermediate'. */
export function getStudentPersona(username: string): string {
  const creds = loadCredentials();
  const c = creds.find(c => c.username.toLowerCase() === username.toLowerCase());
  return c?.persona || 'intermediate';
}

/** Set a student's persona level, persisted to credentialsStore. */
export function setStudentPersona(username: string, persona: string): boolean {
  const creds = loadCredentials();
  const idx = creds.findIndex(c => c.username.toLowerCase() === username.toLowerCase());
  if (idx === -1) return false;
  creds[idx].persona = persona;
  saveCredentials(creds);
  return true;
}
