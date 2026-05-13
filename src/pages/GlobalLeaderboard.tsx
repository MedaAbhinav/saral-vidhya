import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function GlobalLeaderboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<{ name: string, points: number, isMe: boolean }[]>([]);

  useEffect(() => {
    const dummyUsers = [
      { name: "Rahul Sharma", points: 8500, isMe: false },
      { name: "Aisha Khan", points: 9200, isMe: false },
      { name: "Tariq Ali", points: 6400, isMe: false },
      { name: "Sneha Reddy", points: 7100, isMe: false },
      { name: "Rohan Patel", points: 5300, isMe: false },
    ];

    let myTotalPoints = 0;
    // Iterate over all possible subjects in local storage and sum scores
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('ekam_quiz_score_')) {
            myTotalPoints += parseInt(localStorage.getItem(key) || '0', 10);
        }
    }
    
    // Scale points to make it logically equivalent to the dummy user totals
    myTotalPoints = myTotalPoints * 5;

    // Combine and sort
    const all = [...dummyUsers, { name: "You (Student)", points: myTotalPoints, isMe: true }];
    all.sort((a, b) => b.points - a.points);
    setUsers(all);
  }, []);

  const topThree = useMemo(() => users.slice(0, 3), [users]);
  const rest = useMemo(() => users.slice(3), [users]);

  const medalForRank = (rank: number) => {
    if (rank === 1) return { emoji: '🥇', label: 'Gold' };
    if (rank === 2) return { emoji: '🥈', label: 'Silver' };
    if (rank === 3) return { emoji: '🥉', label: 'Bronze' };
    return null;
  };

  const initials = (name: string) => {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map(p => p[0]?.toUpperCase()).join('');
  };

  return (
    <div className="page glb-page">
      <div className="glb-topbar">
        <button onClick={() => navigate(-1)} className="glb-back-btn" type="button">
          ‹ Back
        </button>
      </div>

      <div className="glb-hero card">
        <div>
          <h1 className="glb-title">Global Leaderboard</h1>
          <p className="glb-subtitle">Your total performance across all subjects compared to peers.</p>
        </div>
        <div className="glb-badge">🏆</div>
      </div>

      {topThree.length > 0 && (
        <div className="glb-podium">
          {[2, 1, 3].map((rank) => {
            const u = topThree[rank - 1];
            if (!u) return <div key={rank} />;
            const medal = medalForRank(rank);
            return (
              <div key={rank} className={`glb-podium-card rank-${rank} ${u.isMe ? 'is-me' : ''}`}>
                <div className="glb-podium-medal" aria-label={medal?.label || `Rank ${rank}`}>
                  {medal?.emoji}
                </div>
                <div className="glb-avatar" aria-hidden="true">{initials(u.name)}</div>
                <div className="glb-name" title={u.name}>{u.name}</div>
                <div className="glb-points">{u.points} pts</div>
                <div className="glb-rank">#{rank}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="glb-list card">
        {rest.map((u, idx) => {
          const rank = idx + 4;
          return (
            <div key={`${u.name}-${rank}`} className={`glb-row ${u.isMe ? 'is-me' : ''}`}>
              <div className="glb-row-left">
                <div className="glb-row-rank">#{rank}</div>
                <div className="glb-row-avatar" aria-hidden="true">{initials(u.name)}</div>
                <div className="glb-row-name" title={u.name}>{u.name}</div>
              </div>
              <div className="glb-row-points">{u.points} pts</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
