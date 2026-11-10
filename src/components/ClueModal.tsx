import React, { useState } from 'react';
import type {
  BuzzEntry,
  ClueOutcome,
  ClueState,
  Contestant,
} from '../types/game';
import { formatCurrency } from '../utils/gameLogic';

interface ClueModalProps {
  clue: ClueState;
  categoryTitle: string;
  contestants: Contestant[];
  buzzOrder: BuzzEntry[];
  buzzerOpen: boolean;
  onOutcomeToggle: (contestantId: string, outcome: ClueOutcome) => void;
  onDailyDoubleLockWager: (contestantId: string, wager: number) => void;
  onReopenBuzzers: () => void;
  onCompleteAndClose: () => void;
}

export const ClueModal: React.FC<ClueModalProps> = ({
  clue,
  categoryTitle,
  contestants,
  buzzOrder,
  buzzerOpen,
  onOutcomeToggle,
  onDailyDoubleLockWager,
  onReopenBuzzers,
  onCompleteAndClose,
}) => {
  const [selectedDdContestantId, setSelectedDdContestantId] = useState<string>(
    clue.ddContestantId ?? ''
  );
  const [ddWagerInput, setDdWagerInput] = useState<string>(
    clue.ddWager !== undefined ? String(clue.ddWager) : String(clue.value)
  );
  const [editingDdWager, setEditingDdWager] = useState<boolean>(false);

  const isDailyDoublePreReveal =
    clue.dailyDouble && !clue.ddRevealed && !clue.completed;

  const selectedDdContestant = contestants.find(
    (c) => c.id === selectedDdContestantId
  );

  const handleConfirmDailyDoubleWager = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDdContestantId) return;
    const numericWager = Math.max(0, Math.floor(Number(ddWagerInput) || 0));
    onDailyDoubleLockWager(selectedDdContestantId, numericWager);
    setEditingDdWager(false);
  };

  // Pre-reveal screen for Daily Double (must select contestant & enter wager BEFORE answer is revealed)
  if (isDailyDoublePreReveal || editingDdWager) {
    return (
      <div className="clue-overlay">
        <div className="clue-overlay-header">
          <div className="clue-meta">
            <span>{categoryTitle}</span>
            <span>•</span>
            <span>DAILY DOUBLE (${clue.value})</span>
          </div>
          {clue.completed && (
            <button
              type="button"
              className="secondary-action-btn"
              onClick={() => setEditingDdWager(false)}
            >
              Cancel Edit
            </button>
          )}
        </div>

        <div className="clue-card-body">
          <form className="dd-card" onSubmit={handleConfirmDailyDoubleWager}>
            <div className="dd-title">DAILY DOUBLE!</div>
            <p style={{ color: '#d4d9ff', fontSize: '1.05rem' }}>
              Select the contestant who controls the board:
            </p>

            <div className="dd-contestant-selector">
              {contestants.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`dd-player-btn ${
                    selectedDdContestantId === c.id ? 'selected' : ''
                  }`}
                  onClick={() => setSelectedDdContestantId(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {selectedDdContestant && (
              <div className="dd-wager-panel">
                <div className="dd-current-score">
                  {selectedDdContestant.name}&apos;s Current Total:{' '}
                  <span>{formatCurrency(selectedDdContestant.score)}</span>
                </div>

                <label
                  htmlFor="dd-wager-input"
                  style={{
                    fontSize: '0.9rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#cbd0ff',
                  }}
                >
                  Enter Wager ($)
                </label>
                <input
                  id="dd-wager-input"
                  type="number"
                  min={0}
                  step={1}
                  className="wager-input"
                  value={ddWagerInput}
                  onChange={(e) => setDdWagerInput(e.target.value)}
                  required
                />

                <button type="submit" className="primary-action-btn">
                  {editingDdWager ? 'Update Wager & Return to Clue' : 'Reveal Answer'}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    );
  }

  // Revealed Clue Card (matches clue-card.png)
  const displayClueText =
    clue.answer.trim() || `[No answer text set in board.yaml for ${categoryTitle} $${clue.value}]`;

  const firstBuzzer = buzzOrder[0];
  const effectiveAmount = clue.dailyDouble
    ? (clue.ddWager ?? clue.value)
    : clue.value;

  const scoringContestants = clue.dailyDouble && clue.ddContestantId
    ? contestants.filter((c) => c.id === clue.ddContestantId)
    : contestants;

  return (
    <div className="clue-overlay">
      <div className="clue-overlay-header">
        <div className="clue-meta">
          <span>{categoryTitle}</span>
          <span>•</span>
          <span>
            {clue.dailyDouble
              ? `DAILY DOUBLE (Wager: ${formatCurrency(effectiveAmount)})`
              : `$${clue.value}`}
          </span>
          {clue.completed && (
            <span className="review-badge">
              Reviewing Completed Clue (Click buttons below to adjust score)
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {clue.dailyDouble && (
            <button
              type="button"
              className="small-btn"
              onClick={() => setEditingDdWager(true)}
            >
              Change DD Player / Wager
            </button>
          )}
          {!clue.dailyDouble && (
            <button
              type="button"
              className="small-btn"
              onClick={onReopenBuzzers}
            >
              {buzzerOpen ? 'Reset / Clear Buzzers' : 'Unlock Buzzers'}
            </button>
          )}
        </div>
      </div>

      <div className="clue-card-body">
        <div className="clue-text">{displayClueText}</div>

        {!clue.dailyDouble && (
          <div className="buzzer-banner">
            {firstBuzzer ? (
              <>
                <div className="first-buzz-pill">
                  🔔 1st Buzz: {firstBuzzer.contestantName}
                </div>
                {buzzOrder.length > 1 && (
                  <div className="buzz-queue-list">
                    {buzzOrder.slice(1).map((b, i) => (
                      <span key={b.contestantId}>
                        #{i + 2} {b.contestantName} (+{b.deltaMs}ms)
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div
                style={{
                  fontSize: '0.9rem',
                  color: buzzerOpen ? '#8ce99a' : '#9aa2d6',
                  marginTop: 8,
                }}
              >
                {buzzerOpen
                  ? '● Buzzers Open — Waiting for players to buzz in...'
                  : '○ Buzzers Locked'}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="clue-scoring-footer">
        <div className="scoring-contestants-row">
          {scoringContestants.map((contestant) => {
            const outcome = clue.outcomes[contestant.id];
            const isFirstBuzz = firstBuzzer?.contestantId === contestant.id;
            return (
              <div
                key={contestant.id}
                className={`scoring-contestant-box ${
                  isFirstBuzz ? 'is-buzz-winner' : ''
                } ${outcome === 'correct' ? 'credited' : ''} ${
                  outcome === 'incorrect' ? 'docked' : ''
                }`}
              >
                <div className="scoring-contestant-header">
                  <span>
                    {isFirstBuzz ? '🔔 ' : ''}
                    {contestant.name}
                  </span>
                  <span className="scoring-contestant-total">
                    {formatCurrency(contestant.score)}
                  </span>
                </div>

                <div className="scoring-buttons">
                  <button
                    type="button"
                    className={`score-btn correct ${
                      outcome === 'correct' ? 'active' : ''
                    }`}
                    onClick={() => onOutcomeToggle(contestant.id, 'correct')}
                    title={
                      outcome === 'correct'
                        ? 'Credited! Click again to undo.'
                        : `Credit +$${effectiveAmount} to ${contestant.name}`
                    }
                  >
                    {outcome === 'correct'
                      ? `✓ Credited (+$${effectiveAmount})`
                      : `+ $${effectiveAmount}`}
                  </button>

                  <button
                    type="button"
                    className={`score-btn incorrect ${
                      outcome === 'incorrect' ? 'active' : ''
                    }`}
                    onClick={() => onOutcomeToggle(contestant.id, 'incorrect')}
                    title={
                      outcome === 'incorrect'
                        ? 'Docked! Click again to undo.'
                        : `Dock -$${effectiveAmount} from ${contestant.name}`
                    }
                  >
                    {outcome === 'incorrect'
                      ? `✗ Docked (-$${effectiveAmount})`
                      : `- $${effectiveAmount}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="clue-footer-actions">
          <button
            type="button"
            className="primary-action-btn"
            onClick={onCompleteAndClose}
          >
            {clue.completed ? 'Done Reviewing Clue' : 'Complete Clue & Return to Board'}
          </button>
        </div>
      </div>
    </div>
  );
};
