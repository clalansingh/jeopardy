import React, { useState } from 'react';
import type { Contestant } from '../types/game';

interface SetupScreenProps {
  initialContestants: Contestant[];
  initialPassword: string;
  buzzUrl: string;
  onStartGame: (contestants: Contestant[], password: string) => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({
  initialContestants,
  initialPassword,
  buzzUrl,
  onStartGame,
}) => {
  const [count, setCount] = useState<number>(
    Math.min(5, Math.max(2, initialContestants.length || 3))
  );
  const [names, setNames] = useState<string[]>(() => {
    const base = initialContestants.map((c) => c.name);
    while (base.length < 5) {
      base.push(`Player ${base.length + 1}`);
    }
    return base;
  });
  const [password, setPassword] = useState<string>(initialPassword);

  const handleNameChange = (index: number, value: string) => {
    setNames((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const contestants: Contestant[] = Array.from({ length: count }, (_, idx) => ({
      id: `player-${idx + 1}`,
      name: names[idx]?.trim() || `Player ${idx + 1}`,
      score: 0,
    }));
    onStartGame(contestants, password.trim());
  };

  return (
    <div className="setup-screen">
      <form className="setup-card" onSubmit={handleSubmit}>
        <h1 className="setup-title">JEOPARDY!</h1>

        <div className="setup-section">
          <label className="setup-label">Number of Contestants (2 – 5)</label>
          <div className="count-selector">
            {[2, 3, 4, 5].map((num) => (
              <button
                key={num}
                type="button"
                className={`count-btn ${count === num ? 'active' : ''}`}
                onClick={() => setCount(num)}
              >
                {num} Players
              </button>
            ))}
          </div>
        </div>

        <div className="setup-section">
          <label className="setup-label">Contestant Names</label>
          <div className="contestant-inputs-grid">
            {Array.from({ length: count }, (_, idx) => (
              <input
                key={idx}
                type="text"
                className="text-input"
                placeholder={`Player ${idx + 1} Name`}
                value={names[idx] ?? ''}
                onChange={(e) => handleNameChange(idx, e.target.value)}
                required
              />
            ))}
          </div>
        </div>

        <div className="setup-section">
          <label className="setup-label">
            Mobile Buzzer Session Password
          </label>
          <input
            type="text"
            className="text-input"
            placeholder="Enter password for players to join"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div style={{ fontSize: '0.85rem', color: '#b5bcff', marginTop: 4 }}>
            Players on the same Wi-Fi can open{' '}
            <strong style={{ color: '#d69f4c' }}>{buzzUrl}</strong> and enter
            this password to use their phone as a buzzer.
          </div>
        </div>

        <button type="submit" className="primary-action-btn" style={{ marginTop: 6 }}>
          Start Jeopardy Game
        </button>
      </form>
    </div>
  );
};
