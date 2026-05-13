import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import branding from '../config/branding.json';

export default function Onboarding() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');

  const handleSubmit = () => {
    if (!username.trim()) return;
    
    // Save to global localStorage
    localStorage.setItem('username', username.trim());
    
    // After boarding, redirect to home
    navigate('/', { replace: true });
  };

  return (
    <div className="page selection-page" style={{ paddingTop: '60px' }}>
      <div className="branding-header" style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center', marginBottom: '24px' }}>
        <img src={branding.logoPrimary} alt={`${branding.appName} logo`} style={{ height: '60px', borderRadius: '12px' }} />
      </div>
      
      <h1 style={{ textAlign: 'center', marginBottom: '8px' }}>Welcome to {branding.appName}</h1>
      <p className="subtitle" style={{ textAlign: 'center', marginBottom: '32px' }}>Let's get started by setting up your profile.</p>

      <div style={{ maxWidth: '400px', margin: '0 auto', marginBottom: '32px' }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>What is your name?</label>
        <input 
          type="text" 
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter your name"
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', background: 'var(--surface)', color: 'var(--text)' }}
        />
      </div>

      <div style={{ textAlign: 'center' }}>
        <button 
          className="btn primary" 
          disabled={!username.trim()}
          onClick={handleSubmit}
          style={{ padding: '14px 32px', fontSize: '1.1rem', cursor: (!username.trim()) ? 'not-allowed' : 'pointer', opacity: (!username.trim()) ? 0.6 : 1 }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
