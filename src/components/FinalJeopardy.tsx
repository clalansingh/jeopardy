import React, { useEffect, useState } from 'react';
import type {
  ClueOutcome,
  Contestant,
  FinalJeopardyState,
} from '../types/game';
import { formatCurrency } from '../utils/gameLogic';

interface FinalJeopardyProps {
  finalState: FinalJeopardyState;
  contestants: Contestant[];
  onSetStage: (stage: FinalJeopardyState['stage']) => void;
  onUpdateResult: (
    contestantId: string,
    wager: number,
    outcome?: ClueOutcome | null
  ) => void;
}

export const FinalJeopardy: React.FC<FinalJeopardyProps> = ({
  finalState,
  contestants,
  onSetStage,
  onUpdateResult,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(30);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  useEffect(() => {
    if (!timerRunning) return;
    if (secondsLeft <= 0) {
      setTimerRunning(false);
      return;
    }
    const interval = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, secondsLeft]);

  const categoryText =
    finalState.category.trim() || 'FINAL JEOPARDY CATEGORY';
  const answerText =
    finalState.answer.trim() ||
    '[No Final Jeopardy answer set in board.yaml]';

  // Find current leader(s) for display in wagering stage
  const maxScore = Math.max(...contestants.map((c) => c.score), 0);

  return (
    <div className="final-jeopardy-screen">
      <div className="fj-stage-header">
        <div className="fj-label">FINAL JEOPARDY!</div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'center',
            marginTop: 10,
          }}
        >
          <button
            type="button"
            className={`small-btn ${
              finalState.stage === 'category' ? 'active' : ''
            }`}
            onClick={() => onSetStage('category')}
          >
            1. Category & Totals
          </button>
          <button
            type="button"
            className={`small-btn ${
              finalState.stage === 'clue' ? 'active' : ''
            }`}
            onClick={() => onSetStage('clue')}
          >
            2. Reveal Answer & Timer
          </button>
          <button
            type="button"
            className={`small-btn ${
              finalState.stage === 'wagering' ? 'active' : ''
            }`}
            onClick={() => onSetStage('wagering')}
          >
            3. Enter Wagers & Scoring
          </button>
        </div>
      </div>

      {finalState.stage === 'category' && (
        <>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 24,
            }}
          >
            <div className="fj-category-box">{categoryText}</div>
            <p style={{ color: '#cbd0ff', fontSize: '1.1rem' }}>
              Contestants: Write down your wager on paper now based on your
              current total below.
            </p>
          </div>

          <div className="fj-wagering-grid">
            {contestants.map((c) => (
              <div key={c.id} className="fj-player-card">
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: '1.2rem',
                    textTransform: 'uppercase',
                  }}
                >
                  {c.name}
                </div>
                <div
                  className={`podium-score ${c.score < 0 ? 'negative' : ''}`}
                  style={{ fontSize: '2.2rem' }}
                >
                  {formatCurrency(c.score)}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="primary-action-btn"
            onClick={() => {
              setSecondsLeft(30);
              setTimerRunning(false);
              onSetStage('clue');
            }}
          >
            Reveal Final Jeopardy Answer →
          </button>
        </>
      )}

      {finalState.stage === 'clue' && (
        <>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 24,
              maxWidth: 1100,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-category)',
                color: 'var(--color-dollar-gold)',
                fontSize: '1.4rem',
                letterSpacing: '0.05em',
              }}
            >
              CATEGORY: {categoryText}
            </div>
            <div className="clue-text">{answerText}</div>

            <div className="fj-timer-bar">
              <div
                className={`fj-timer-display ${
                  secondsLeft === 0 ? 'expired' : ''
                }`}
              >
                {secondsLeft === 0 ? "TIME'S UP!" : `${secondsLeft}s`}
              </div>

              <button
                type="button"
                className="primary-action-btn"
                onClick={() => setTimerRunning((r) => !r)}
              >
                {timerRunning ? 'Pause Timer' : 'Start 30s Timer'}
              </button>

              <button
                type="button"
                className="secondary-action-btn"
                onClick={() => {
                  setTimerRunning(false);
                  setSecondsLeft(30);
                }}
              >
                Reset 30s
              </button>
            </div>
          </div>

          <button
            type="button"
            className="primary-action-btn"
            onClick={() => {
              setTimerRunning(false);
              onSetStage('wagering');
            }}
          >
            Timer Expired — Enter Wagers & Results →
          </button>
        </>
      )}

      {finalState.stage === 'wagering' && (
        <>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: 'var(--font-clue)',
                fontSize: '1.35rem',
                color: '#fff',
                maxWidth: 900,
                textShadow: '2px 2px 0 #000',
              }}
            >
              {answerText}
            </div>
            <p style={{ color: '#cbd0ff', marginTop: 8, fontSize: '0.95rem' }}>
              Enter each contestant&apos;s written wager and mark whether they
              got it Right or Wrong:
            </p>
          </div>

          <div className="fj-wagering-grid">
            {contestants.map((c) => {
              const wager = finalState.wagers[c.id] ?? 0;
              const outcome = finalState.outcomes[c.id];
              const isLeader =
                c.score === maxScore &&
                Object.keys(finalState.outcomes).length === contestants.length;

              return (
                <div
                  key={c.id}
                  className="fj-player-card"
                  style={
                    isLeader
                      ? {
                          borderColor: 'var(--color-dollar-gold)',
                          boxShadow: '0 0 22px rgba(214, 159, 76, 0.7)',
                        }
                      : undefined
                  }
                >
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: '1.2rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    {isLeader ? '🏆 ' : ''}
                    {c.name}
                  </div>

                  <div
                    className={`podium-score ${c.score < 0 ? 'negative' : ''}`}
                    style={{ fontSize: '2rem' }}
                  >
                    {formatCurrency(c.score)}
                  </div>

                  <label
                    style={{
                      fontSize: '0.8rem',
                      color: '#b8bfff',
                      textTransform: 'uppercase',
                    }}
                  >
                    Wager ($)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className="wager-input"
                    style={{ width: '100%', fontSize: '1.4rem' }}
                    value={wager === 0 && !(c.id in finalState.wagers) ? '' : wager}
                    placeholder="0"
                    onChange={(e) =>
                      onUpdateResult(
                        c.id,
                        Math.max(0, Math.floor(Number(e.target.value) || 0)),
                        undefined
                      )
                    }
                  />

                  <div className="scoring-buttons">
                    <button
                      type="button"
                      className={`score-btn correct ${
                        outcome === 'correct' ? 'active' : ''
                      }`}
                      onClick={() => onUpdateResult(c.id, wager, 'correct')}
                    >
                      {outcome === 'correct' ? '✓ Right' : 'Right (+)'}
                    </button>

                    <button
                      type="button"
                      className={`score-btn incorrect ${
                        outcome === 'incorrect' ? 'active' : ''
                      }`}
                      onClick={() => onUpdateResult(c.id, wager, 'incorrect')}
                    >
                      {outcome === 'incorrect' ? '✗ Wrong' : 'Wrong (-)'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div />
        </>
      )}
    </div>
  );
};
