import React, { useState } from 'react';
import type { Contestant, TimerSettings } from '../types/game';
import type { BoardFileEntry } from '../utils/boardLoader';

interface SetupScreenProps {
  availableBoards: BoardFileEntry[];
  selectedBoardFilename: string;
  initialContestants: Contestant[];
  initialPassword: string;
  initialTimerSettings: TimerSettings;
  hasGameInProgress: boolean;
  onSaveSetup: (options: {
    boardFilename: string;
    contestants: Contestant[];
    password: string;
    timerSettings: TimerSettings;
    resetBoardAndScores: boolean;
  }) => void;
  onBackToHome: () => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({
  availableBoards,
  selectedBoardFilename,
  initialContestants,
  initialPassword,
  initialTimerSettings,
  hasGameInProgress,
  onSaveSetup,
  onBackToHome,
}) => {
  const [boardFilename, setBoardFilename] = useState<string>(
    selectedBoardFilename || availableBoards[0]?.filename || 'board.yaml'
  );
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
  const [timerSettings, setTimerSettings] =
    useState<TimerSettings>(initialTimerSettings);

  // If a game is already in progress, ask whether to reset board & scores (default false so they don't accidentally wipe)
  const [shouldReset, setShouldReset] = useState<boolean>(!hasGameInProgress);

  const handleNameChange = (index: number, value: string) => {
    setNames((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const buildContestants = (resetScores: boolean): Contestant[] => {
    return Array.from({ length: count }, (_, idx) => {
      const existing = initialContestants[idx];
      return {
        id: existing?.id || `player-${idx + 1}`,
        name: names[idx]?.trim() || `Player ${idx + 1}`,
        score: resetScores ? 0 : (existing?.score ?? 0),
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const resetBoardAndScores = hasGameInProgress ? shouldReset : true;
    onSaveSetup({
      boardFilename,
      contestants: buildContestants(resetBoardAndScores),
      password: password.trim(),
      timerSettings: {
        buzzerWindowEnabled: timerSettings.buzzerWindowEnabled,
        buzzerWindowSeconds: Math.max(
          1,
          Math.floor(Number(timerSettings.buzzerWindowSeconds) || 5)
        ),
        playerAnswerEnabled: timerSettings.playerAnswerEnabled,
        playerAnswerSeconds: Math.max(
          1,
          Math.floor(Number(timerSettings.playerAnswerSeconds) || 5)
        ),
      },
      resetBoardAndScores,
    });
  };

  return (
    <div className="setup-screen">
      <form className="setup-card" onSubmit={handleSubmit}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            type="button"
            className="small-btn"
            onClick={onBackToHome}
          >
            ← Home
          </button>
          <h1 className="setup-title" style={{ fontSize: '2.6rem' }}>
            HOST SETUP
          </h1>
          <div style={{ width: 68 }} />
        </div>

        {/* Mid-game reset prompt when visiting Setup from a game in progress */}
        {hasGameInProgress && (
          <div className="setup-reset-prompt">
            <div
              style={{
                fontWeight: 800,
                color: 'var(--color-dollar-gold)',
                fontSize: '1rem',
                marginBottom: 8,
                textTransform: 'uppercase',
              }}
            >
              Game in Progress — Reset Board and Scores?
            </div>
            <div className="count-selector">
              <button
                type="button"
                className={`count-btn ${!shouldReset ? 'active' : ''}`}
                onClick={() => setShouldReset(false)}
              >
                No — Keep Board & Scores
              </button>
              <button
                type="button"
                className={`count-btn ${shouldReset ? 'active' : ''}`}
                onClick={() => setShouldReset(true)}
              >
                Yes — Reset Board & Scores
              </button>
            </div>
          </div>
        )}

        {/* Board Selection from /boards directory */}
        <div className="setup-section">
          <label className="setup-label">
            Select Board (/boards directory)
          </label>
          <div className="count-selector" style={{ flexWrap: 'wrap' }}>
            {availableBoards.map((board) => (
              <button
                key={board.filename}
                type="button"
                className={`count-btn ${
                  boardFilename === board.filename ? 'active' : ''
                }`}
                onClick={() => {
                  setBoardFilename(board.filename);
                  if (
                    hasGameInProgress &&
                    board.filename !== selectedBoardFilename
                  ) {
                    setShouldReset(true);
                  }
                }}
              >
                {board.filename}
              </button>
            ))}
          </div>
        </div>

        {/* Contestant Count */}
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

        {/* Contestant Names */}
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

        {/* Timers Configuration */}
        <div className="setup-section">
          <label className="setup-label">Countdown Timers</label>
          <div className="timer-config-grid">
            <div className="timer-config-box">
              <label className="timer-checkbox-row">
                <input
                  type="checkbox"
                  checked={timerSettings.buzzerWindowEnabled}
                  onChange={(e) =>
                    setTimerSettings((prev) => ({
                      ...prev,
                      buzzerWindowEnabled: e.target.checked,
                    }))
                  }
                />
                <span>Post-Clue Buzzer Timer</span>
              </label>
              <div className="timer-seconds-row">
                <input
                  type="number"
                  min={1}
                  max={60}
                  className="text-input"
                  style={{ width: 84, textAlign: 'center' }}
                  disabled={!timerSettings.buzzerWindowEnabled}
                  value={timerSettings.buzzerWindowSeconds}
                  onChange={(e) =>
                    setTimerSettings((prev) => ({
                      ...prev,
                      buzzerWindowSeconds: Math.max(
                        1,
                        Number(e.target.value) || 1
                      ),
                    }))
                  }
                />
                <span>seconds</span>
              </div>
            </div>

            <div className="timer-config-box">
              <label className="timer-checkbox-row">
                <input
                  type="checkbox"
                  checked={timerSettings.playerAnswerEnabled}
                  onChange={(e) =>
                    setTimerSettings((prev) => ({
                      ...prev,
                      playerAnswerEnabled: e.target.checked,
                    }))
                  }
                />
                <span>Player Answer Timer</span>
              </label>
              <div className="timer-seconds-row">
                <input
                  type="number"
                  min={1}
                  max={60}
                  className="text-input"
                  style={{ width: 84, textAlign: 'center' }}
                  disabled={!timerSettings.playerAnswerEnabled}
                  value={timerSettings.playerAnswerSeconds}
                  onChange={(e) =>
                    setTimerSettings((prev) => ({
                      ...prev,
                      playerAnswerSeconds: Math.max(
                        1,
                        Number(e.target.value) || 1
                      ),
                    }))
                  }
                />
                <span>seconds</span>
              </div>
            </div>
          </div>
        </div>

        {/* Session Password */}
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
        </div>

        <button
          type="submit"
          className="primary-action-btn"
          style={{ marginTop: 4 }}
        >
          {hasGameInProgress && !shouldReset
            ? 'Resume Game (Keep Board & Scores)'
            : 'Start New Game'}
        </button>
      </form>
    </div>
  );
};
