import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAnalytics } from '@/utils/analytics';
import { googleTtsSpeak } from '@/services/googleTtsService';

const PERSONA_NAMES: Record<string, string> = {
  'beginner': 'Beginner',
  'intermediate': 'Intermediate',
  'advanced': 'Advanced'
};

const VOICES = [
  { id: 'female', name: 'Female Voice', icon: '👩' },
  { id: 'male', name: 'Male Voice', icon: '👨' }
];

export default function Profile() {
  const [username, setUsername] = useState('');
  const [persona, setPersona] = useState('');
  const [activeVoice, setActiveVoice] = useState(() => {
    const saved = localStorage.getItem('user_voice');
    return saved === 'male' ? 'male' : 'female';
  });
  const [stats, setStats] = useState({ summaries: 0, detailed: 0, quizzes: 0 });
  const [swot, setSwot] = useState({ s: [] as string[], w: [] as string[], o: [] as string[], t: [] as string[] });
  const [rank, setRank] = useState(42);
  const [animate, setAnimate] = useState(false);
  const navigate = useNavigate();
  const treeLogoSrc = `${import.meta.env.BASE_URL}brand-logo.png`;

  useEffect(() => {
    // Trigger entrance animation
    setTimeout(() => setAnimate(true), 100);

    setUsername(localStorage.getItem('username') || 'Student');
    const pId = localStorage.getItem('persona') || localStorage.getItem('global_persona') || 'intermediate';
    setPersona(PERSONA_NAMES[pId] || 'Intermediate');

    // Voice state is initialized directly from localStorage in useState

    // Load analytics for Activity & SWOT
    const data = getAnalytics();

    // Learning Activity
    const summaries = data.chapterVisits.length;
    const detailed = data.toolEvents.filter(e => e.tool === 'detailed').length;
    const quizzes = data.quizRecords.length;
    setStats({ summaries, detailed, quizzes });

    // SWOT Analysis
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const opportunities: string[] = [];
    const threats: string[] = [];

    // Evaluate based on quiz scores
    for (const r of data.quizRecords) {
      const pct = (r.score / r.total) * 100;
      const name = `${r.subjectName || r.subjectId} Ch.${r.chapterNumber}`;
      if (pct >= 80) {
        if (!strengths.includes(name)) strengths.push(name);
      } else if (pct < 60) {
        if (!weaknesses.includes(name)) weaknesses.push(name);
      } else {
        if (!opportunities.includes(name)) opportunities.push(name);
      }
    }

    if (strengths.length === 0) strengths.push("Consistent reading habits");
    if (weaknesses.length === 0) weaknesses.push("None detected yet!");
    if (opportunities.length === 0) opportunities.push("Take more quizzes to discover opportunities");
    if (threats.length === 0) threats.push("Irregular study sessions might affect retention.");

    setSwot({ s: strengths, w: weaknesses, o: opportunities, t: threats });

    // Leaderboard Rank Calculation
    const dummyUsers = [
      { points: 8500 }, { points: 9200 }, { points: 6400 }, { points: 7100 }, { points: 5300 },
    ];
    let myTotalPoints = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('ekam_quiz_score_')) {
        myTotalPoints += parseInt(localStorage.getItem(key) || '0', 10);
      }
    }
    myTotalPoints = myTotalPoints * 5;
    const all = [...dummyUsers, { points: myTotalPoints }];
    all.sort((a, b) => b.points - a.points);
    const myRank = all.findIndex(u => u.points === myTotalPoints) + 1;
    setRank(myRank);
  }, []);

  const changeVoice = (voiceId: string) => {
    setActiveVoice(voiceId);
    localStorage.setItem('user_voice', voiceId);
    // Play a sample of the voice
    const sampleText = voiceId === 'male' ? "This is the male voice." : "This is the female voice.";
    googleTtsSpeak(sampleText, 'en-IN');
  };

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: 'linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%)', padding: '40px 20px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', opacity: animate ? 1 : 0, transform: animate ? 'translateY(0)' : 'translateY(20px)', transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
        
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
            <img
              src={treeLogoSrc}
              alt="Saral Vidhya"
              className="sv-persona-tree-logo"
              style={{ flexShrink: 0 }}
            />
            <h1 style={{ margin: 0, fontSize: 'clamp(1.6rem, 2.8vw, 2.5rem)', fontWeight: 800, background: 'linear-gradient(135deg, #6B21A8, #9333EA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Student Profile
            </h1>
          </div>
          <button
            onClick={() => navigate('/')}
            style={{
              background: '#fff', border: 'none', borderRadius: '50%', width: '48px', height: '48px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(107, 33, 168, 0.15)', color: '#6B21A8', transition: 'all 0.3s ease'
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1) rotate(-5deg)'}
            onMouseOut={e => e.currentTarget.style.transform = 'scale(1) rotate(0deg)'}
            title="Back to Dashboard"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '30px' }}>
          
          {/* Identity Card (Spans 8 cols) */}
          <div style={{ gridColumn: window.innerWidth > 768 ? 'span 8' : 'span 12', background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(10px)', borderRadius: '24px', padding: '32px', border: '1px solid rgba(255,255,255,0.8)', boxShadow: '0 8px 32px rgba(107, 33, 168, 0.05)', display: 'flex', alignItems: 'center', gap: '30px', transition: 'transform 0.3s ease' }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
            <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'linear-gradient(135deg, #A855F7, #EC4899)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', fontWeight: 800, boxShadow: '0 8px 20px rgba(236, 72, 153, 0.3)', flexShrink: 0 }}>
              {username.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '2rem', fontWeight: 800, color: '#1E1B4B' }}>{username}</h2>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 16px', background: '#F3E8FF', color: '#7E22CE', borderRadius: '30px', fontSize: '0.95rem', fontWeight: 700 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#9333EA', display: 'inline-block' }}></span>
                Persona: {persona}
              </div>
            </div>
          </div>

          {/* Leaderboard Rank Card (Spans 4 cols) */}
          <div onClick={() => navigate('/leaderboard')} style={{ gridColumn: window.innerWidth > 768 ? 'span 4' : 'span 12', background: 'linear-gradient(135deg, #FDF2F8 0%, #FFF5F8 100%)', borderRadius: '24px', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid #FBCFE8', boxShadow: '0 8px 32px rgba(236, 72, 153, 0.08)', transition: 'all 0.3s ease' }} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(236, 72, 153, 0.15)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(236, 72, 153, 0.08)'; }}>
            <div style={{ fontSize: '0.9rem', color: '#BE185D', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: '8px' }}>Global Rank</div>
            <div style={{ fontSize: '4rem', fontWeight: 900, color: '#DB2777', lineHeight: 1, textShadow: '2px 4px 12px rgba(219, 39, 119, 0.2)' }}>#{rank}</div>
            <div style={{ marginTop: '12px', fontSize: '0.85rem', color: '#DB2777', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
              View Leaderboard <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
          </div>

          {/* Learning Activity */}
          <div style={{ gridColumn: window.innerWidth > 768 ? 'span 4' : 'span 12', background: '#fff', borderRadius: '24px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: '1.25rem', fontWeight: 700, color: '#1E1B4B', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.5rem' }}>📊</span> Activity
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { label: 'Summaries Read', value: stats.summaries, color: '#3B82F6', bg: '#EFF6FF' },
                { label: 'Detailed Views', value: stats.detailed, color: '#8B5CF6', bg: '#F5F3FF' },
                { label: 'Quizzes Taken', value: stats.quizzes, color: '#EC4899', bg: '#FDF2F8' },
              ].map((stat, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: stat.bg, borderRadius: '16px', border: `1px solid ${stat.color}20` }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#334155' }}>{stat.label}</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: stat.color }}>{stat.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SWOT Analysis */}
          <div style={{ gridColumn: window.innerWidth > 768 ? 'span 8' : 'span 12', background: '#fff', borderRadius: '24px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: '1.25rem', fontWeight: 700, color: '#1E1B4B', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.5rem' }}>🎯</span> SWOT Analysis
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              {[
                { title: 'Strengths', items: swot.s, color: '#10B981', bg: '#F0FDF4', border: '#bbf7d0', icon: '💪' },
                { title: 'Weaknesses', items: swot.w, color: '#EF4444', bg: '#FEF2F2', border: '#fecaca', icon: '⚠️' },
                { title: 'Opportunities', items: swot.o, color: '#3B82F6', bg: '#EFF6FF', border: '#bfdbfe', icon: '🚀' },
                { title: 'Threats', items: swot.t, color: '#F59E0B', bg: '#FFFBEB', border: '#fde68a', icon: '⚡' },
              ].map((section, i) => (
                <div key={i} style={{ background: section.bg, borderRadius: '16px', padding: '20px', border: `1px solid ${section.border}`, transition: 'transform 0.2s ease' }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '1.2rem' }}>{section.icon}</span>
                    <h4 style={{ margin: 0, color: section.color, fontSize: '1.05rem', fontWeight: 700 }}>{section.title}</h4>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '24px', color: '#475569', fontSize: '0.9rem', lineHeight: 1.6, fontWeight: 500 }}>
                    {section.items.map((item, idx) => (
                      <li key={idx} style={{ marginBottom: '6px' }}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Preferences */}
          <div style={{ gridColumn: 'span 12', background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(10px)', borderRadius: '24px', padding: '32px', border: '1px solid rgba(255,255,255,0.8)', boxShadow: '0 8px 32px rgba(107, 33, 168, 0.05)' }}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: '1.25rem', fontWeight: 700, color: '#1E1B4B', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.5rem' }}>⚙️</span> Preferences
            </h3>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '48px' }}>
              <div>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Voice Style</h4>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {VOICES.map(voice => (
                    <button
                      key={voice.id}
                      onClick={() => changeVoice(voice.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '10px 24px',
                        background: activeVoice === voice.id ? '#F3E8FF' : '#fff',
                        border: `2px solid ${activeVoice === voice.id ? '#A855F7' : '#E2E8F0'}`,
                        borderRadius: '16px', cursor: 'pointer',
                        fontWeight: activeVoice === voice.id ? 700 : 500,
                        color: activeVoice === voice.id ? '#7E22CE' : '#475569',
                        fontSize: '1rem',
                        transition: 'all 0.2s ease',
                        boxShadow: activeVoice === voice.id ? '0 4px 12px rgba(168, 85, 247, 0.15)' : 'none'
                      }}
                      onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      <span style={{ fontSize: '1.2rem' }}>{voice.icon}</span>
                      {voice.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
