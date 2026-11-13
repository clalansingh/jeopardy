import React, { useState } from 'react';
import type { BuzzerSessionState } from '../types/game';
import { formatCurrency } from '../utils/gameLogic';

interface PlayerBuzzerProps {
  sessionState: BuzzerSessionState;
  connecting: boolean;
  connectedToHost: boolean;
  joinedContestantId: string | null;
  joinError: string | null;
  onConnectWithPassword: (password: string) => void;
  onSelectContestant: (contestantId: string) => void;
  onSwitchContestant: () => void;
  onDisconnectSession: () => void;
  onBuzz: (contestantId: string) => void;
  onBackToHome?: () => void;
}

export const PlayerBuzzer: React.FC<PlayerBuzzerProps> = ({
  sessionState,
  connecting,
  connectedToHost,
  joinedContestantId,
  joinError,
  onConnectWithPassword,
  onSelectContestant,
  onSwitchContestant,
  onDisconnectSession,
  onBuzz,
  onBackToHome,
}) => {
  const [password, setPassword] = useState<string>('');
  const [selectedContestantId, setSelectedContestantId] = useState<string>('');

  const activeContestant = sessionState.contestants.find(
    (c) => c.id === joinedContestantId
  );

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    onConnectWithPassword(password.trim());
  };

  const handleContestantSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetId =
      selectedContestantId || sessionState.contestants[0]?.id || '';
    if (!targetId) return;
    onSelectContestant(targetId);
  };

  // Step 1: Enter Session Password to connect to the Host's PeerJS room
  if (!connectedToHost) {
    return (
      <div className="setup-screen">
        <form className="setup-card" onSubmit={handlePasswordSubmit}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {onBackToHome ? (
              <button
                type="button"
                className="small-btn"
                onClick={onBackToHome}
              >
                ← Home
              </button>
            ) : (
              <div style={{ width: 68 }} />
            )}
            <h1 className="setup-title" style={{ fontSize: '2.2rem' }}>
              JOIN BUZZER
            </h1>
            <div style={{ width: 68 }} />
          </div>

          <div className="setup-section">
            <label className="setup-label">Enter Session Password</label>
            <input
              type="text"
              className="text-input"
              placeholder="Enter password shown on Host TV"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={connecting}
              required
            />
          </div>

          {joinError && (
            <div
              style={{
                background: 'rgba(201, 42, 42, 0.25)',
                border: '1px solid #ff5c5c',
                color: '#ff9e9e',
                padding: '10px 14px',
                borderRadius: 6,
                fontSize: '0.9rem',
              }}
            >
              {joinError}
            </div>
          )}

          <button
            type="submit"
            className="primary-action-btn"
            disabled={connecting}
          >
            {connecting ? 'Connecting to Host...' : 'Connect to Game'}
          </button>
        </form>
      </div>
    );
  }

  // Step 2: Select Contestant Name from the Host's roster
  if (!joinedContestantId || !activeContestant) {
    return (
      <div className="setup-screen">
        <form className="setup-card" onSubmit={handleContestantSubmit}>
          <h1 className="setup-title" style={{ fontSize: '2.5rem' }}>
            SELECT YOUR NAME
          </h1>

          <div className="setup-section">
            <label className="setup-label">Contestants</label>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {sessionState.contestants.map((c) => {
                const isSelected =
                  (selectedContestantId ||
                    sessionState.contestants[0]?.id) === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`count-btn ${isSelected ? 'active' : ''}`}
                    style={{ textAlign: 'left', padding: '12px 16px' }}
                    onClick={() => setSelectedContestantId(c.id)}
                  >
                    {c.name}{' '}
                    {c.connected && (
                      <span style={{ fontSize: '0.8rem', opacity: 0.75 }}>
                        (Connected)
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="secondary-action-btn"
              onClick={onDisconnectSession}
            >
              Change Password
            </button>
            <button
              type="submit"
              className="primary-action-btn"
              style={{ flex: 1 }}
            >
              Join as Contestant
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Step 3: Live Buzzer Button
  const buzzIndex = sessionState.buzzOrder.findIndex(
    (b) => b.contestantId === activeContestant.id
  );
  const isLockedOut = sessionState.lockedOutContestantIds.includes(
    activeContestant.id
  );

  let statusClass = 'locked';
  let mainTitle = 'LOCKED';
  let subtitle = 'Waiting for host to enable buzzers...';

  if (isLockedOut) {
    statusClass = 'locked-out';
    mainTitle = 'LOCKED OUT';
    subtitle = 'Already answered on this clue';
  } else if (buzzIndex === 0) {
    statusClass = 'buzzed-first';
    mainTitle = 'YOU BUZZED IN!';
    subtitle = 'Answer aloud now!';
  } else if (buzzIndex > 0) {
    const entry = sessionState.buzzOrder[buzzIndex];
    statusClass = 'buzzed-queued';
    mainTitle = `BUZZED #${buzzIndex + 1}`;
    subtitle = `+${entry?.deltaMs ?? 0}ms behind ${sessionState.buzzOrder[0]?.contestantName}`;
  } else if (sessionState.buzzerOpen) {
    statusClass = 'open';
    mainTitle = 'BUZZ!';
    subtitle = sessionState.activeClueLabel || 'Tap anywhere to buzz in!';
  }

  const handleTriggerBuzz = () => {
    if (sessionState.buzzerOpen && !isLockedOut && buzzIndex === -1) {
      onBuzz(activeContestant.id);
    }
  };

  return (
    <div className="buzzer-page">
      <div className="buzzer-top-bar">
        <div>
          <div
            style={{
              fontWeight: 800,
              fontSize: '1.1rem',
              textTransform: 'uppercase',
            }}
          >
            {activeContestant.name}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-dollar)',
              fontSize: '1.35rem',
              color: 'var(--color-dollar-gold)',
            }}
          >
            {formatCurrency(activeContestant.score)}
          </div>
        </div>

        <button
          type="button"
          className="small-btn"
          onClick={onSwitchContestant}
        >
          Switch Player
        </button>
      </div>

      <button
        type="button"
        className={`buzzer-main-button ${statusClass}`}
        onPointerDown={handleTriggerBuzz}
        onClick={handleTriggerBuzz}
      >
        <div className="buzzer-big-label">{mainTitle}</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{subtitle}</div>
      </button>
    </div>
  );
};
