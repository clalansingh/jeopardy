import React, { useEffect, useRef, useState } from 'react';
import type {
  BuzzEntry,
  ClueOutcome,
  ClueState,
  Contestant,
  TimerSettings,
} from '../types/game';
import { formatCurrency } from '../utils/gameLogic';
import { playTimesUpChime } from '../utils/sound';
import { PodiumCountdown } from './PodiumCountdown';

interface ClueModalProps {
  clue: ClueState;
  categoryTitle: string;
  contestants: Contestant[];
  buzzOrder: BuzzEntry[];
  buzzerOpen: boolean;
  timerSettings: TimerSettings;
  onOutcomeToggle: (contestantId: string, outcome: ClueOutcome) => void;
  onDailyDoubleLockWager: (contestantId: string, wager: number) => void;
  onEnableBuzzers: () => void;
  onLockBuzzers: () => void;
  onCompleteAndClose: () => void;
}

export const ClueModal: React.FC<ClueModalProps> = ({
  clue,
  categoryTitle,
  contestants,
  buzzOrder,
  buzzerOpen,
  timerSettings,
  onOutcomeToggle,
  onDailyDoubleLockWager,
  onEnableBuzzers,
  onLockBuzzers,
  onCompleteAndClose,
}) => {
  const [selectedDdContestantId, setSelectedDdContestantId] = useState<string>(
    clue.ddContestantId ?? ''
  );
  const [ddWagerInput, setDdWagerInput] = useState<string>(
    clue.ddWager !== undefined ? String(clue.ddWager) : String(clue.value)
  );
  const [editingDdWager, setEditingDdWager] = useState<boolean>(false);

  // Active countdown state: 'none' | 'buzzer_window' | 'player_answer'
  const [activeTimerType, setActiveTimerType] = useState<
    'none' | 'buzzer_window' | 'player_answer'
  >('none');
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [expiredMessage, setExpiredMessage] = useState<string | null>(null);

  const firstBuzzer = buzzOrder[0];
  const prevFirstBuzzerIdRef = useRef<string | undefined>(undefined);
  const prevBuzzerOpenRef = useRef<boolean>(false);

  // Detect transitions into Buzzer Window Open or Player Answering
  useEffect(() => {
    if (clue.dailyDouble) return;

    const currentBuzzId = firstBuzzer?.contestantId;

    // Case 1: A player just buzzed in!
    if (currentBuzzId && currentBuzzId !== prevFirstBuzzerIdRef.current) {
      prevFirstBuzzerIdRef.current = currentBuzzId;
      prevBuzzerOpenRef.current = buzzerOpen;
      setExpiredMessage(null);
      if (timerSettings.playerAnswerEnabled) {
        setActiveTimerType('player_answer');
        setRemainingSeconds(timerSettings.playerAnswerSeconds);
      } else {
        setActiveTimerType('none');
      }
      return;
    }

    // Case 2: Buzzers just opened (either via "Enable Buzzers" button or auto-reopen after wrong answer)
    if (buzzerOpen && !prevBuzzerOpenRef.current && !currentBuzzId) {
      prevFirstBuzzerIdRef.current = undefined;
      prevBuzzerOpenRef.current = true;
      setExpiredMessage(null);
      if (timerSettings.buzzerWindowEnabled) {
        setActiveTimerType('buzzer_window');
        setRemainingSeconds(timerSettings.buzzerWindowSeconds);
      } else {
        setActiveTimerType('none');
      }
      return;
    }

    // Case 3: Buzzers closed without an active buzzer (e.g., someone got it right or all players locked out)
    if (!buzzerOpen && !currentBuzzId) {
      prevFirstBuzzerIdRef.current = undefined;
      prevBuzzerOpenRef.current = false;
      if (activeTimerType !== 'none' && remainingSeconds > 0) {
        setActiveTimerType('none');
      }
    } else {
      prevBuzzerOpenRef.current = buzzerOpen;
      prevFirstBuzzerIdRef.current = currentBuzzId;
    }
  }, [
    buzzerOpen,
    firstBuzzer?.contestantId,
    clue.dailyDouble,
    timerSettings.buzzerWindowEnabled,
    timerSettings.buzzerWindowSeconds,
    timerSettings.playerAnswerEnabled,
    timerSettings.playerAnswerSeconds,
    activeTimerType,
    remainingSeconds,
  ]);

  // Second-by-second countdown interval
  useEffect(() => {
    if (activeTimerType === 'none') return;

    if (remainingSeconds <= 0) {
      playTimesUpChime();
      if (activeTimerType === 'buzzer_window') {
        onLockBuzzers();
        setExpiredMessage(
          "⏰ TIME'S UP! No one buzzed in — Player in control of the board selects again."
        );
      } else if (activeTimerType === 'player_answer') {
        const responderName = firstBuzzer?.contestantName || 'Player';
        setExpiredMessage(
          `⏰ TIME'S UP for ${responderName}! Click the - button below to deduct their points.`
        );
      }
      setActiveTimerType('none');
      return;
    }

    const timer = setTimeout(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    activeTimerType,
    remainingSeconds,
    firstBuzzer?.contestantName,
    onLockBuzzers,
  ]);

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
                  {editingDdWager
                    ? 'Update Wager & Return to Clue'
                    : 'Reveal Answer'}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    );
  }

  const displayClueText =
    clue.answer.trim() ||
    `[No answer text set in board YAML for ${categoryTitle} $${clue.value}]`;

  const effectiveAmount = clue.dailyDouble
    ? (clue.ddWager ?? clue.value)
    : clue.value;

  const scoringContestants =
    clue.dailyDouble && clue.ddContestantId
      ? contestants.filter((c) => c.id === clue.ddContestantId)
      : contestants;

  // Check if all contestants have already tried and missed this clue
  const incorrectCount = contestants.filter(
    (c) => clue.outcomes[c.id] === 'incorrect'
  ).length;
  const allContestantsLockedOut = incorrectCount >= contestants.length;
  const someoneGotItRight = contestants.some(
    (c) => clue.outcomes[c.id] === 'correct'
  );

  // Determine whether to display the segmented PodiumCountdown bar
  const showBuzzerCountdown =
    !clue.dailyDouble &&
    timerSettings.buzzerWindowEnabled &&
    (activeTimerType === 'buzzer_window' ||
      (expiredMessage && !firstBuzzer));
  const showAnswerCountdown =
    !clue.dailyDouble &&
    timerSettings.playerAnswerEnabled &&
    Boolean(firstBuzzer) &&
    (activeTimerType === 'player_answer' || Boolean(expiredMessage));

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
          {!clue.dailyDouble && !allContestantsLockedOut && (
            <button
              type="button"
              className="small-btn"
              onClick={onEnableBuzzers}
            >
              {buzzerOpen ? 'Restart Buzzer Timer' : 'Enable Buzzers'}
            </button>
          )}
        </div>
      </div>

      <div className="clue-card-body">
        <div className="clue-text">{displayClueText}</div>

        {!clue.dailyDouble && (
          <div className="buzzer-banner">
            {/* Host Enable Buzzers button before buzzers are activated */}
            {!buzzerOpen &&
              !firstBuzzer &&
              !expiredMessage &&
              !someoneGotItRight &&
              !allContestantsLockedOut && (
                <button
                  type="button"
                  className="enable-buzzers-btn"
                  onClick={onEnableBuzzers}
                >
                  🔔 Enable Buzzers (After Reading Aloud)
                </button>
              )}

            {/* Active responder who buzzed in */}
            {firstBuzzer && (
              <div className="first-buzz-pill">
                🔔 {firstBuzzer.contestantName} Buzzed In!
              </div>
            )}

            {/* Buzzer Open status */}
            {buzzerOpen && !firstBuzzer && (
              <div
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: '#8ce99a',
                  marginTop: 6,
                }}
              >
                ● Buzzers Active — Waiting for players to buzz in...
              </div>
            )}

            {/* Segmented Podium Countdown Bar (matches podium-countdown.png) */}
            {showBuzzerCountdown && (
              <PodiumCountdown
                totalSeconds={timerSettings.buzzerWindowSeconds}
                remainingSeconds={
                  activeTimerType === 'buzzer_window' ? remainingSeconds : 0
                }
                label={`Buzzer Window (${
                  activeTimerType === 'buzzer_window' ? remainingSeconds : 0
                }s)`}
              />
            )}

            {showAnswerCountdown && (
              <PodiumCountdown
                totalSeconds={timerSettings.playerAnswerSeconds}
                remainingSeconds={
                  activeTimerType === 'player_answer' ? remainingSeconds : 0
                }
                label={`${firstBuzzer?.contestantName} Answer Timer (${
                  activeTimerType === 'player_answer' ? remainingSeconds : 0
                }s)`}
              />
            )}

            {/* Expired / Time's Up Banner */}
            {expiredMessage && (
              <div className="times-up-banner">{expiredMessage}</div>
            )}

            {allContestantsLockedOut && !someoneGotItRight && (
              <div className="times-up-banner">
                All contestants have attempted this clue. Player in control of
                the board selects again.
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
                    onClick={() => {
                      setActiveTimerType('none');
                      setExpiredMessage(null);
                      onOutcomeToggle(contestant.id, 'correct');
                    }}
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
                    onClick={() => {
                      setActiveTimerType('none');
                      setExpiredMessage(null);
                      onOutcomeToggle(contestant.id, 'incorrect');
                    }}
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
            {clue.completed
              ? 'Done Reviewing Clue'
              : 'Complete Clue & Return to Board'}
          </button>
        </div>
      </div>
    </div>
  );
};
