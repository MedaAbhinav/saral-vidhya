import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAnalytics, clearAnalytics, type AnalyticsData } from '@/utils/analytics';
import {
  loadCredentials, addCredential, updateCredential, deleteCredential,
  setStudentPersona, getStudentPersona,
  type Credential, type Role,
} from '@/utils/credentialsStore';
import {
  loadAssignments, addAssignment, deleteAssignment,
  getAssignmentsForStudent, type Assignment,
} from '@/utils/assignmentsStore';
import { getManifest, type Subject } from '@/data/contentRepository';
import UserMenu from '@/components/UserMenu';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(iso: string) {
  try { return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return iso; }
}
function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' }); }
  catch { return iso; }
}
function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

const TOOL_LABELS: Record<string, string> = {
  summary: 'Summary', detailed: 'Detailed Notes', flashcards: 'Flash Cards',
  podcasts: 'Podcasts', ask: 'Ask AI', videos: 'Videos', mindmap: 'Mindmap',
  pyq: 'PYQ', popquiz: 'Pop Quiz', qbank: 'Question Bank', swot: 'SWOT Analysis',
};

const PERSONA_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  beginner:     { bg: '#DCFCE7', text: '#166534', border: '#86EFAC' },
  intermediate: { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
  advanced:     { bg: '#EDE9FE', text: '#4C1D95', border: '#C4B5FD' },
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div style={{
      background: 'white', borderRadius: '14px', padding: '20px',
      border: '1px solid #E5E7EB', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      display: 'flex', flexDirection: 'column', gap: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{
          width: '40px', height: '40px', borderRadius: '10px',
          background: color + '20', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0,
        }}>{icon}</span>
        <span style={{ fontSize: '0.8rem', color: '#6B7280', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{sub}</div>}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'white', borderRadius: '16px', padding: '24px',
      border: '1px solid #E5E7EB', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    }}>
      <h2 style={{ margin: '0 0 20px', fontSize: '1rem', fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{icon}</span> {title}
      </h2>
      {children}
    </div>
  );
}

// ── Badge ────────────────────────────────────────────────────────────────────
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
      background: color + '20', color,
    }}>{label}</span>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function ExpertDashboard() {
  const _navigate = useNavigate();
  void _navigate;
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'chapters' | 'tools' | 'quiz' | 'activity' | 'students' | 'assignments' | 'logins'>('overview');
  const [confirmClear, setConfirmClear] = useState(false);

  // Logins tab state
  const [creds, setCreds] = useState<Credential[]>([]);
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newRole, setNewRole] = useState<Role>('student');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPass, setEditPass] = useState('');
  const [showPassFor, setShowPassFor] = useState<string | null>(null);

  // Students tab state
  const [manifest, setManifest] = useState<Subject[]>([]);
  const [personaMsg, setPersonaMsg] = useState('');

  // Assignments tab state
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [aForm, setAForm] = useState({ studentUsername: '', subjectId: '', chapterNumber: 1, chapterName: '', dueDate: '', notes: '' });
  const [aError, setAError] = useState('');
  const [aSuccess, setASuccess] = useState('');
  const [assignFor, setAssignFor] = useState<string | null>(null); // username of student to quick-assign

  const studentName = localStorage.getItem('username') || '—';

  useEffect(() => {
    setData(getAnalytics());
    setCreds(loadCredentials());
    setAssignments(loadAssignments());
    getManifest().then(m => setManifest(m.subjects));
  }, []);

  const studentPersona = getStudentPersona(studentName);

  const handleClearData = () => {
    clearAnalytics();
    setData(getAnalytics());
    setConfirmClear(false);
  };

  const handlePersonaOverride = (newPersona: string) => {
    localStorage.setItem('persona', newPersona);
    alert(`✅ Student persona updated to "${capitalize(newPersona)}". The student will see this change on their next session.`);
  };

  const handleSetStudentPersona = (username: string, persona: string) => {
    setStudentPersona(username, persona);
    setCreds(loadCredentials());
    setPersonaMsg(`✅ ${username}'s persona set to ${capitalize(persona)}`);
    setTimeout(() => setPersonaMsg(''), 3000);
  };

  const handleAddAssignment = () => {
    setAError(''); setASuccess('');
    if (!aForm.studentUsername) { setAError('Select a student.'); return; }
    if (!aForm.subjectId) { setAError('Select a subject.'); return; }
    if (!aForm.chapterNumber) { setAError('Enter chapter number.'); return; }
    if (!aForm.dueDate) { setAError('Set a due date.'); return; }
    const sub = manifest.find(s => s.id === aForm.subjectId);
    const ch = sub?.chapters.find(c => c.number === Number(aForm.chapterNumber));
    addAssignment({
      studentUsername: aForm.studentUsername,
      subjectId: aForm.subjectId,
      subjectName: sub?.name || aForm.subjectId,
      chapterNumber: Number(aForm.chapterNumber),
      chapterName: ch?.name || aForm.chapterName,
      dueDate: aForm.dueDate,
      notes: aForm.notes,
    });
    setAssignments(loadAssignments());
    setASuccess(`Assignment created for ${aForm.studentUsername}!`);
    setAForm({ studentUsername: assignFor || '', subjectId: '', chapterNumber: 1, chapterName: '', dueDate: '', notes: '' });
    setTimeout(() => setASuccess(''), 4000);
  };

  const handleDeleteAssignment = (id: string) => {
    if (!confirm('Delete this assignment?')) return;
    deleteAssignment(id);
    setAssignments(loadAssignments());
  };

  if (!data) return <div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>;

  // ── Derived stats ──────────────────────────────────────────────────────────
  const uniqueChapters = new Set(data.chapterVisits.map(v => `${v.subjectId}_${v.chapterNumber}`)).size;
  const uniqueSubjects = new Set(data.chapterVisits.map(v => v.subjectId)).size;

  // Tool usage counts
  const toolCounts: Record<string, number> = {};
  for (const e of data.toolEvents) {
    toolCounts[e.tool] = (toolCounts[e.tool] || 0) + 1;
  }
  const topTools = Object.entries(toolCounts).sort((a,b) => b[1]-a[1]);
  const totalToolUses = data.toolEvents.length;

  // Quiz stats
  const totalQuizzes = data.quizRecords.length;
  const avgScore = totalQuizzes
    ? Math.round(data.quizRecords.reduce((s,r) => s + (r.score/r.total)*100, 0) / totalQuizzes)
    : null;

  // Chapter breakdown
  const chapterMap: Record<string, { subjectId: string; subjectName: string; chapterNumber: number; chapterName: string; visits: number; tools: Set<string>; lastVisit: string }> = {};
  for (const v of data.chapterVisits) {
    const key = `${v.subjectId}_${v.chapterNumber}`;
    if (!chapterMap[key]) chapterMap[key] = { subjectId: v.subjectId, subjectName: v.subjectName, chapterNumber: v.chapterNumber, chapterName: v.chapterName, visits: 0, tools: new Set(), lastVisit: v.timestamp };
    chapterMap[key].visits++;
    chapterMap[key].lastVisit = v.timestamp;
  }
  for (const e of data.toolEvents) {
    const key = `${e.subjectId}_${e.chapterNumber}`;
    if (chapterMap[key]) chapterMap[key].tools.add(e.tool);
  }
  const chapters = Object.values(chapterMap).sort((a,b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime());

  const personaCol = PERSONA_COLORS[studentPersona] || PERSONA_COLORS.intermediate;

  const handleAddUser = () => {
    setAddError(''); setAddSuccess('');
    if (!newUser.trim() || !newPass.trim()) { setAddError('Username and password are required.'); return; }
    if (newPass.length < 6) { setAddError('Password must be at least 6 characters.'); return; }
    const result = addCredential(newUser.trim(), newPass, newRole);
    if ('error' in result) { setAddError(result.error); return; }
    setCreds(loadCredentials());
    setNewUser(''); setNewPass('');
    setAddSuccess(`Account "${result.username}" created successfully.`);
  };

  const handleUpdatePass = (id: string) => {
    if (!editPass.trim()) return;
    if (editPass.length < 6) { alert('Password must be at least 6 characters.'); return; }
    updateCredential(id, { password: editPass });
    setCreds(loadCredentials());
    setEditingId(null); setEditPass('');
  };

  const handleDelete = (id: string, username: string) => {
    if (!confirm(`Delete account "${username}"? This cannot be undone.`)) return;
    deleteCredential(id);
    setCreds(loadCredentials());
  };

  const TABS = [
    { id: 'overview',     label: 'Overview',     icon: '📊' },
    { id: 'students',     label: 'Students',     icon: '👥' },
    { id: 'assignments',  label: 'Assignments',  icon: '📋' },
    { id: 'chapters',     label: 'Chapters',     icon: '📚' },
    { id: 'tools',        label: 'Tools',        icon: '🔧' },
    { id: 'quiz',         label: 'Quizzes',      icon: '⚡' },
    { id: 'activity',     label: 'Activity',     icon: '📅' },
    { id: 'logins',       label: 'Logins',       icon: '🔐' },
  ] as const;

  return (
    <div style={{ minHeight: '100vh', background: '#F3F4F6', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Top bar ── */}
      <header style={{
        background: 'white', borderBottom: '1px solid #E5E7EB', padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '60px', position: 'sticky', top: 0, zIndex: 50,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/brand-logo.png" alt="logo" style={{ height: '34px', borderRadius: '8px' }} />
          <div>
            <span style={{ fontWeight: 800, fontSize: '1rem', color: '#111827' }}>Expert Mode</span>
            <span style={{ marginLeft: '10px', fontSize: '0.72rem', background: '#EDE9FE', color: '#5B21B6', padding: '2px 8px', borderRadius: '20px', fontWeight: 600 }}>ADMIN</span>
          </div>
        </div>
        <UserMenu />
      </header>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px' }}>

        {/* ── Student card ── */}
        <div style={{
          background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
          borderRadius: '18px', padding: '24px 28px', marginBottom: '24px',
          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '16px',
          boxShadow: '0 4px 20px rgba(99,102,241,0.35)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '14px',
              background: 'rgba(255,255,255,0.25)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem',
            }}>👤</div>
            <div>
              <p style={{ margin: 0, opacity: 0.8, fontSize: '0.8rem', fontWeight: 500 }}>Student</p>
              <h1 style={{ margin: '2px 0 6px', fontSize: '1.4rem', fontWeight: 800 }}>{studentName}</h1>
              <span style={{
                padding: '4px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700,
                background: personaCol.bg, color: personaCol.text, border: `1px solid ${personaCol.border}`,
              }}>
                {capitalize(studentPersona)} Level
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {(['beginner','intermediate','advanced'] as const).map(p => (
              <button
                key={p}
                onClick={() => handlePersonaOverride(p)}
                style={{
                  padding: '8px 18px', borderRadius: '8px',
                  border: studentPersona === p ? '2px solid white' : '2px solid rgba(255,255,255,0.4)',
                  background: studentPersona === p ? 'white' : 'rgba(255,255,255,0.15)',
                  color: studentPersona === p ? '#6366F1' : 'white',
                  cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem',
                }}
              >
                {capitalize(p)}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'white', padding: '4px', borderRadius: '12px', border: '1px solid #E5E7EB', width: 'fit-content' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: activeTab === t.id ? '#6366F1' : 'transparent',
                color: activeTab === t.id ? 'white' : '#6B7280',
                fontWeight: activeTab === t.id ? 700 : 500, fontSize: '0.84rem',
                display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s',
              }}
            >{t.icon} {t.label}</button>
          ))}
        </div>

        {/* ══ OVERVIEW ══ */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              <StatCard icon="📖" label="Chapters Studied" value={uniqueChapters} sub={`across ${uniqueSubjects} subject${uniqueSubjects !== 1 ? 's' : ''}`} color="#6366F1" />
              <StatCard icon="🔧" label="Tool Uses" value={totalToolUses} sub={topTools[0] ? `Most used: ${TOOL_LABELS[topTools[0][0]] || topTools[0][0]}` : 'No data yet'} color="#10B981" />
              <StatCard icon="⚡" label="Quizzes Taken" value={totalQuizzes} sub={avgScore !== null ? `Avg score: ${avgScore}%` : 'No quizzes yet'} color="#F59E0B" />
              <StatCard icon="🔄" label="Persona Changes" value={data.personaHistory.length} sub={data.personaHistory.length ? `Latest: → ${capitalize(data.personaHistory[data.personaHistory.length-1].to)}` : 'No changes'} color="#8B5CF6" />
            </div>

            {/* Persona history */}
            {data.personaHistory.length > 0 && (
              <Section title="Persona History" icon="🎯">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[...data.personaHistory].reverse().slice(0,8).map((h, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#F9FAFB', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.8rem', color: '#6B7280', minWidth: '140px' }}>{fmt(h.timestamp)}</span>
                      <Badge label={capitalize(h.from)} color={PERSONA_COLORS[h.from]?.text || '#6B7280'} />
                      <span style={{ color: '#9CA3AF' }}>→</span>
                      <Badge label={capitalize(h.to)} color={PERSONA_COLORS[h.to]?.text || '#6B7280'} />
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {data.chapterVisits.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' }}>
                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📊</div>
                <p style={{ fontSize: '1rem', fontWeight: 600 }}>No learning data yet</p>
                <p style={{ fontSize: '0.85rem' }}>Data will appear here once the student starts studying.</p>
              </div>
            )}
          </div>
        )}

        {/* ══ STUDENTS ══ */}
        {activeTab === 'students' && (() => {
          const students = creds.filter(c => c.role === 'student');
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {personaMsg && (
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '10px 16px', color: '#15803D', fontWeight: 600, fontSize: '0.88rem' }}>
                  {personaMsg}
                </div>
              )}
              <Section title={`All Students (${students.length})`} icon="👥">
                {students.length === 0
                  ? <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '32px' }}>No student accounts yet. Create one in the Logins tab.</p>
                  : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: '#F9FAFB' }}>
                          {['Student', 'Current Persona', 'Change Persona', 'Assignments', 'Quick Assign'].map(h => (
                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#374151', fontWeight: 700, borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {students.map(s => {
                          const sp = getStudentPersona(s.username);
                          const pc = PERSONA_COLORS[sp] || PERSONA_COLORS.intermediate;
                          const aCount = getAssignmentsForStudent(s.username).length;
                          return (
                            <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                              <td style={{ padding: '14px 14px', fontWeight: 700, color: '#111827' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span>👤</span> {s.username}
                                </div>
                              </td>
                              <td style={{ padding: '14px 14px' }}>
                                <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700, background: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}>
                                  {capitalize(sp)}
                                </span>
                              </td>
                              <td style={{ padding: '14px 14px' }}>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  {(['beginner', 'intermediate', 'advanced'] as const).map(p => (
                                    <button key={p} onClick={() => handleSetStudentPersona(s.username, p)}
                                      style={{ padding: '4px 10px', borderRadius: '6px', border: `1px solid ${sp === p ? '#6366F1' : '#E5E7EB'}`, background: sp === p ? '#EEF2FF' : 'white', color: sp === p ? '#4F46E5' : '#6B7280', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}>
                                      {capitalize(p)}
                                    </button>
                                  ))}
                                </div>
                              </td>
                              <td style={{ padding: '14px 14px' }}>
                                <span style={{ background: aCount > 0 ? '#FEF3C7' : '#F3F4F6', color: aCount > 0 ? '#92400E' : '#6B7280', borderRadius: '20px', padding: '3px 10px', fontWeight: 700, fontSize: '0.78rem' }}>
                                  {aCount} assigned
                                </span>
                              </td>
                              <td style={{ padding: '14px 14px' }}>
                                <button
                                  onClick={() => { setAssignFor(s.username); setAForm(f => ({ ...f, studentUsername: s.username })); setActiveTab('assignments'); }}
                                  style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #6366F1', background: '#EEF2FF', color: '#4F46E5', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' }}>
                                  + Assign
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>
            </div>
          );
        })()}

        {/* ══ ASSIGNMENTS ══ */}
        {activeTab === 'assignments' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Create Assignment Form */}
            <Section title="Create Assignment" icon="📋">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                {/* Student */}
                <div>
                  <label style={labelStyle}>Student</label>
                  <select value={aForm.studentUsername} onChange={e => setAForm(f => ({ ...f, studentUsername: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">— Select student —</option>
                    {creds.filter(c => c.role === 'student').map(c => (
                      <option key={c.id} value={c.username}>{c.username}</option>
                    ))}
                  </select>
                </div>
                {/* Subject */}
                <div>
                  <label style={labelStyle}>Subject</label>
                  <select value={aForm.subjectId} onChange={e => setAForm(f => ({ ...f, subjectId: e.target.value, chapterNumber: 1, chapterName: '' }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">— Select subject —</option>
                    {manifest.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                {/* Chapter */}
                <div>
                  <label style={labelStyle}>Chapter</label>
                  {manifest.find(s => s.id === aForm.subjectId)
                    ? (
                      <select value={aForm.chapterNumber} onChange={e => { const ch = manifest.find(s => s.id === aForm.subjectId)?.chapters.find(c => c.number === Number(e.target.value)); setAForm(f => ({ ...f, chapterNumber: Number(e.target.value), chapterName: ch?.name || '' })); }} style={{ ...inputStyle, cursor: 'pointer' }}>
                        {manifest.find(s => s.id === aForm.subjectId)!.chapters.map(c => (
                          <option key={c.number} value={c.number}>Ch.{c.number} – {c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <input type="number" min={1} value={aForm.chapterNumber} onChange={e => setAForm(f => ({ ...f, chapterNumber: Number(e.target.value) }))} style={inputStyle} placeholder="Chapter number" />
                    )
                  }
                </div>
                {/* Due Date */}
                <div>
                  <label style={labelStyle}>Due Date</label>
                  <input type="date" value={aForm.dueDate} onChange={e => setAForm(f => ({ ...f, dueDate: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              {/* Notes */}
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Notes / Instructions (optional)</label>
                <textarea value={aForm.notes} onChange={e => setAForm(f => ({ ...f, notes: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="e.g. Focus on the summary and mindmap sections." />
              </div>
              {aError && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontSize: '0.83rem', color: '#DC2626', marginBottom: '10px' }}>⚠️ {aError}</div>}
              {aSuccess && <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '10px 14px', fontSize: '0.83rem', color: '#15803D', marginBottom: '10px' }}>✅ {aSuccess}</div>}
              <button onClick={handleAddAssignment} style={{ padding: '11px 24px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', color: 'white', fontWeight: 700, fontSize: '0.9rem', boxShadow: '0 3px 10px rgba(99,102,241,0.3)' }}>
                Create Assignment
              </button>
            </Section>

            {/* All Assignments list */}
            <Section title={`All Assignments (${assignments.length})`} icon="📋">
              {assignments.length === 0
                ? <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '32px' }}>No assignments created yet.</p>
                : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[...assignments].reverse().map(a => {
                    const overdue = new Date(a.dueDate) < new Date() && a.status === 'pending';
                    return (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '14px 16px', background: '#F9FAFB', borderRadius: '10px', border: `1px solid ${overdue ? '#FECACA' : '#E5E7EB'}` }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 700, color: '#111827' }}>👤 {a.studentUsername}</span>
                            <span style={{ background: '#EEF2FF', color: '#4F46E5', borderRadius: '6px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 }}>{a.subjectName}</span>
                            <span style={{ background: '#F3F4F6', color: '#374151', borderRadius: '6px', padding: '2px 8px', fontSize: '0.75rem' }}>Ch.{a.chapterNumber} – {a.chapterName}</span>
                            <span style={{ background: a.status === 'completed' ? '#DCFCE7' : overdue ? '#FEF2F2' : '#FEF3C7', color: a.status === 'completed' ? '#166534' : overdue ? '#DC2626' : '#92400E', borderRadius: '20px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>
                              {a.status === 'completed' ? '✓ Done' : overdue ? '⚠ Overdue' : `Due: ${fmtDate(a.dueDate)}`}
                            </span>
                          </div>
                          {a.notes && <p style={{ margin: 0, fontSize: '0.8rem', color: '#6B7280' }}>{a.notes}</p>}
                        </div>
                        <button onClick={() => handleDeleteAssignment(a.id)} style={{ background: 'none', border: '1px solid #FECACA', borderRadius: '6px', padding: '4px 10px', color: '#DC2626', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0 }}>Delete</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          </div>
        )}

        {/* ══ CHAPTERS ══ */}
        {activeTab === 'chapters' && (
          <Section title={`Chapters Studied (${chapters.length})`} icon="📚">
            {chapters.length === 0
              ? <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '32px' }}>No chapters visited yet.</p>
              : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                      {['Subject', 'Chapter', 'Visits', 'Tools Used', 'Last Visited'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#374151', fontWeight: 700, borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chapters.map((ch, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '12px 14px', color: '#374151', fontWeight: 500 }}>{ch.subjectName || capitalize(ch.subjectId)}</td>
                        <td style={{ padding: '12px 14px', color: '#111827', fontWeight: 600 }}>Ch.{ch.chapterNumber} – {ch.chapterName}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ background: '#EEF2FF', color: '#4F46E5', borderRadius: '20px', padding: '2px 10px', fontWeight: 700, fontSize: '0.8rem' }}>{ch.visits}</span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {ch.tools.size === 0
                              ? <span style={{ color: '#9CA3AF', fontSize: '0.78rem' }}>—</span>
                              : [...ch.tools].map(t => (
                                <span key={t} style={{ background: '#F3F4F6', color: '#374151', borderRadius: '6px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 500 }}>
                                  {TOOL_LABELS[t] || t}
                                </span>
                              ))
                            }
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', color: '#6B7280', fontSize: '0.8rem' }}>{fmtDate(ch.lastVisit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        {/* ══ TOOLS ══ */}
        {activeTab === 'tools' && (
          <Section title="Tool Usage Breakdown" icon="🔧">
            {topTools.length === 0
              ? <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '32px' }}>No tool usage recorded yet.</p>
              : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {topTools.map(([tool, count]) => {
                  const pct = Math.round((count / totalToolUses) * 100);
                  return (
                    <div key={tool}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#374151' }}>{TOOL_LABELS[tool] || tool}</span>
                        <span style={{ fontSize: '0.82rem', color: '#6B7280' }}>{count} uses · {pct}%</span>
                      </div>
                      <div style={{ height: '10px', background: '#F3F4F6', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#6366F1,#8B5CF6)', borderRadius: '5px', transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        {/* ══ QUIZ ══ */}
        {activeTab === 'quiz' && (
          <Section title={`Quiz Results (${totalQuizzes} attempts)`} icon="⚡">
            {data.quizRecords.length === 0
              ? <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '32px' }}>No quizzes taken yet.</p>
              : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                      {['Date', 'Subject', 'Chapter', 'Score', 'Result'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#374151', fontWeight: 700, borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.quizRecords].reverse().map((r, i) => {
                      const pct = Math.round((r.score / r.total) * 100);
                      const color = pct >= 80 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td style={{ padding: '12px 14px', color: '#6B7280', fontSize: '0.8rem' }}>{fmtDate(r.timestamp)}</td>
                          <td style={{ padding: '12px 14px', color: '#374151' }}>{r.subjectName || capitalize(r.subjectId)}</td>
                          <td style={{ padding: '12px 14px', color: '#111827', fontWeight: 500 }}>Ch.{r.chapterNumber} – {r.chapterName}</td>
                          <td style={{ padding: '12px 14px', fontWeight: 700, color }}>{r.score}/{r.total}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ background: color + '20', color, borderRadius: '20px', padding: '3px 10px', fontWeight: 700, fontSize: '0.78rem' }}>
                              {pct}% {pct >= 80 ? '🌟' : pct >= 50 ? '👍' : '💪'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        {/* ══ ACTIVITY ══ */}
        {activeTab === 'activity' && (
          <Section title="Recent Activity" icon="📅">
            {data.chapterVisits.length === 0 && data.toolEvents.length === 0
              ? <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '32px' }}>No activity recorded yet.</p>
              : (() => {
                // Merge visits and tool events, sort by time desc
                const events = [
                  ...data.chapterVisits.map(v => ({ type: 'visit' as const, label: `Opened Ch.${v.chapterNumber} – ${v.chapterName}`, sub: v.subjectName || capitalize(v.subjectId), ts: v.timestamp, icon: '📖' })),
                  ...data.toolEvents.map(e => ({ type: 'tool' as const, label: `Used ${TOOL_LABELS[e.tool] || e.tool}`, sub: `Ch.${e.chapterNumber} – ${e.chapterName}`, ts: e.timestamp, icon: '🔧' })),
                ].sort((a,b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 60);

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                    {events.map((ev, i) => (
                      <div key={i} style={{ display: 'flex', gap: '14px', padding: '12px 0', borderBottom: i < events.length-1 ? '1px solid #F3F4F6' : 'none' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: ev.type==='visit'?'#EEF2FF':'#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {ev.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', color: '#111827' }}>{ev.label}</p>
                          <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#9CA3AF' }}>{ev.sub}</p>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#9CA3AF', whiteSpace: 'nowrap', alignSelf: 'center' }}>{fmt(ev.ts)}</span>
                      </div>
                    ))}
                  </div>
                );
              })()
            }
          </Section>
        )}

        {/* ══ LOGINS ══ */}
        {activeTab === 'logins' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Existing accounts table */}
            <Section title={`Login Accounts (${creds.length})`} icon="🔐">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                      {['Username', 'Role', 'Password', 'Created', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#374151', fontWeight: 700, borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {creds.map(c => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        {/* Username */}
                        <td style={{ padding: '14px 14px', fontWeight: 700, color: '#111827', fontSize: '0.9rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.1rem' }}>{c.role === 'expert' ? '👨‍💼' : '👤'}</span>
                            {c.username}
                          </div>
                        </td>
                        {/* Role badge */}
                        <td style={{ padding: '14px 14px' }}>
                          <span style={{
                            padding: '3px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700,
                            background: c.role === 'expert' ? '#EDE9FE' : '#DBEAFE',
                            color: c.role === 'expert' ? '#5B21B6' : '#1D4ED8',
                          }}>{c.role === 'expert' ? 'Expert' : 'Student'}</span>
                        </td>
                        {/* Password (masked / revealed) */}
                        <td style={{ padding: '14px 14px' }}>
                          {editingId === c.id ? (
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <input
                                type="text"
                                value={editPass}
                                onChange={e => setEditPass(e.target.value)}
                                placeholder="New password"
                                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '0.82rem', width: '140px' }}
                              />
                              <button onClick={() => handleUpdatePass(c.id)} style={actionBtn('#10B981')}>Save</button>
                              <button onClick={() => { setEditingId(null); setEditPass(''); }} style={actionBtn('#6B7280')}>Cancel</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <code style={{ fontSize: '0.82rem', background: '#F3F4F6', padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.05em', color: '#374151' }}>
                                {showPassFor === c.id ? c.password : '••••••••'}
                              </code>
                              <button
                                onClick={() => setShowPassFor(showPassFor === c.id ? null : c.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', color: '#9CA3AF', padding: '2px' }}
                                title={showPassFor === c.id ? 'Hide' : 'Show'}
                              >{showPassFor === c.id ? '🙈' : '👁️'}</button>
                            </div>
                          )}
                        </td>
                        {/* Created */}
                        <td style={{ padding: '14px 14px', color: '#9CA3AF', fontSize: '0.78rem' }}>{fmtDate(c.createdAt)}</td>
                        {/* Actions */}
                        <td style={{ padding: '14px 14px' }}>
                          {editingId !== c.id && (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={() => { setEditingId(c.id); setEditPass(''); }} style={actionBtn('#6366F1')}>Change Password</button>
                              {c.username !== 'expert' && (
                                <button onClick={() => handleDelete(c.id, c.username)} style={actionBtn('#EF4444')}>Delete</button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* Add new account */}
            <Section title="Add New Account" icon="➕">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '480px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Username</label>
                    <input
                      type="text"
                      value={newUser}
                      onChange={e => { setNewUser(e.target.value); setAddError(''); setAddSuccess(''); }}
                      placeholder="e.g. student2"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Password</label>
                    <input
                      type="text"
                      value={newPass}
                      onChange={e => { setNewPass(e.target.value); setAddError(''); setAddSuccess(''); }}
                      placeholder="Min 6 characters"
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Role</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {(['student', 'expert'] as Role[]).map(r => (
                      <button
                        key={r}
                        onClick={() => setNewRole(r)}
                        style={{
                          padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                          border: `2px solid ${newRole === r ? '#6366F1' : '#E5E7EB'}`,
                          background: newRole === r ? '#EEF2FF' : 'white',
                          color: newRole === r ? '#4F46E5' : '#6B7280',
                        }}
                      >{r === 'expert' ? '👨‍💼 Expert' : '👤 Student'}</button>
                    ))}
                  </div>
                </div>

                {addError && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontSize: '0.83rem', color: '#DC2626' }}>⚠️ {addError}</div>}
                {addSuccess && <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '10px 14px', fontSize: '0.83rem', color: '#15803D' }}>✅ {addSuccess}</div>}

                <button
                  onClick={handleAddUser}
                  style={{
                    padding: '11px 24px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                    color: 'white', fontWeight: 700, fontSize: '0.9rem',
                    alignSelf: 'flex-start',
                    boxShadow: '0 3px 10px rgba(99,102,241,0.3)',
                  }}
                >Create Account</button>
              </div>
            </Section>
          </div>
        )}

        {/* ── Danger zone ── */}
        <div style={{ marginTop: '28px', padding: '20px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '14px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 700, color: '#991B1B' }}>⚠️ Danger Zone</h3>
          {!confirmClear ? (
            <button onClick={() => setConfirmClear(true)} style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid #FCA5A5', background: 'white', color: '#DC2626', cursor: 'pointer', fontWeight: 600, fontSize: '0.84rem' }}>
              Clear All Analytics Data
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.84rem', color: '#7F1D1D' }}>Are you sure? This cannot be undone.</span>
              <button onClick={handleClearData} style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', background: '#DC2626', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>Yes, Clear</button>
              <button onClick={() => setConfirmClear(false)} style={{ padding: '7px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>Cancel</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared inline styles ───────────────────────────────────────────────────────
function actionBtn(color: string): React.CSSProperties {
  return {
    padding: '5px 12px', borderRadius: '6px', border: `1px solid ${color}30`,
    background: color + '10', color, cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem',
    whiteSpace: 'nowrap',
  };
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: '8px',
  border: '1.5px solid #E5E7EB', fontSize: '0.88rem', outline: 'none',
  boxSizing: 'border-box', color: '#111827',
};
