import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadCredentials, type Credential } from '@/utils/credentialsStore';

export default function UserMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [creds, setCreds] = useState<Credential[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  const username = localStorage.getItem('username') || 'User';
  const role     = localStorage.getItem('app_role') || 'student';

  useEffect(() => {
    setCreds(loadCredentials());
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const logout = () => {
    localStorage.removeItem('app_authenticated');
    localStorage.removeItem('app_role');
    navigate('/login', { replace: true });
  };

  const switchTo = (cred: Credential) => {
    // Log out current user then redirect to login pre-filled isn't possible,
    // so just log out and let them sign in fresh.
    localStorage.removeItem('app_authenticated');
    localStorage.removeItem('app_role');
    navigate('/login', { replace: true, state: { prefill: cred.username } });
  };

  const otherAccounts = creds.filter(c => c.username.toLowerCase() !== username.toLowerCase());

  const roleColor = role === 'expert'
    ? { bg: '#EDE9FE', text: '#5B21B6' }
    : { bg: '#DBEAFE', text: '#1D4ED8' };

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '8px 16px', borderRadius: '12px',
          border: '1.5px solid var(--border, #E5E7EB)',
          background: open ? 'var(--primary-light, #EEF2FF)' : 'var(--surface, white)',
          cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        <span style={{
          width: '36px', height: '36px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1rem', color: 'white', fontWeight: 700, flexShrink: 0,
        }}>
          {username.charAt(0).toUpperCase()}
        </span>
        <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary, #111827)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {username}
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary, #6B7280)', marginLeft: '2px' }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0,
          minWidth: '280px', background: 'white',
          borderRadius: '16px', border: '1px solid #E5E7EB',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          zIndex: 500, overflow: 'hidden',
        }}>
          {/* Current user info */}
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.2rem', color: 'white', fontWeight: 800, flexShrink: 0,
              }}>
                {username.charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: '#111827' }}>{username}</p>
                <span style={{
                  fontSize: '0.82rem', fontWeight: 600, padding: '2px 10px', borderRadius: '20px',
                  background: roleColor.bg, color: roleColor.text,
                }}>
                  {role === 'expert' ? '👨‍💼 Expert' : '👤 Student'}
                </span>
              </div>
            </div>
          </div>

          {/* Switch account section */}
          {otherAccounts.length > 0 && (
            <div style={{ padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
              <p style={{ margin: '0 0 4px', padding: '0 20px', fontSize: '0.78rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Switch Account
              </p>
              {otherAccounts.map(c => (
                <button
                  key={c.id}
                  onClick={() => switchTo(c)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '11px 20px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    fontSize: '0.95rem', color: '#374151', fontWeight: 500,
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '50%',
                    background: c.role === 'expert' ? 'linear-gradient(135deg,#8B5CF6,#A78BFA)' : 'linear-gradient(135deg,#3B82F6,#60A5FA)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.8rem', color: 'white', fontWeight: 700, flexShrink: 0,
                  }}>
                    {c.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>{c.username}</p>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: '#9CA3AF' }}>{c.role === 'expert' ? 'Expert' : 'Student'}</p>
                  </div>
                  <span style={{ marginLeft: 'auto', color: '#D1D5DB', fontSize: '1rem' }}>›</span>
                </button>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ padding: '8px 0' }}>
            {/* Expert Dashboard link — re-enable when expert mode is active */}
            <button
              onClick={logout}
              style={{
                width: '100%', textAlign: 'left', padding: '12px 20px',
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '12px',
                fontSize: '0.95rem', color: '#EF4444', fontWeight: 600,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span>🚪</span> Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
