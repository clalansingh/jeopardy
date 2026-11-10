import React, { useCallback, useEffect, useState } from 'react';
import defaultBoardYaml from '../board.yaml?raw';
import { ClueModal } from './components/ClueModal';
import { FinalJeopardy } from './components/FinalJeopardy';
import { GameBoard } from './components/GameBoard';
import { PlayerBuzzer } from './components/PlayerBuzzer';
import { SetupScreen } from './components/SetupScreen';
import { useBuzzerSocket } from './hooks/useBuzzerSocket';
import type {
  CategoryState,
  ClueOutcome,
  ClueState,
  Contestant,
  FinalJeopardyState,
  RoundId,
} from './types/game';
import {
  formatCurrency,
  parseBoardYaml,
  toggleClueContestantOutcome,
  updateDailyDoubleWager,
  updateFinalJeopardyResult,
} from './utils/gameLogic';

interface ActiveClueRef {
  round: 'jeopardy' | 'double_jeopardy';
  categoryIndex: number;
  questionIndex: number;
  categoryTitle: string;
}

export const App: React.FC = () => {
  const isBuzzRoute =
    new URLSearchParams(window.location.search).get('mode') === 'buzz' ||
    window.location.hash === '#/buzz' ||
    window.location.pathname.endsWith('/buzz');

  const {
    sessionState,
    hostPeerStatus,
    joinStatus,
    hostInitSession,
    hostSyncContestants,
    hostOpenBuzzers,
    hostLockBuzzers,
    playerConnectWithPassword,
    playerJoin,
    playerLeave,
    playerDisconnectSession,
    playerBuzz,
  } = useBuzzerSocket();

  const [inSetup, setInSetup] = useState<boolean>(true);
  const [password, setPassword] = useState<string>('jeopardy');
  const [contestants, setContestants] = useState<Contestant[]>([
    { id: 'player-1', name: 'Player 1', score: 0 },
    { id: 'player-2', name: 'Player 2', score: 0 },
    { id: 'player-3', name: 'Player 3', score: 0 },
  ]);

  const [round, setRound] = useState<RoundId>('jeopardy');
  const [jeopardyCategories, setJeopardyCategories] = useState<CategoryState[]>(
    () => parseBoardYaml(defaultBoardYaml).jeopardy
  );
  const [doubleJeopardyCategories, setDoubleJeopardyCategories] = useState<
    CategoryState[]
  >(() => parseBoardYaml(defaultBoardYaml).double_jeopardy);
  const [finalJeopardy, setFinalJeopardy] = useState<FinalJeopardyState>(
    () => parseBoardYaml(defaultBoardYaml).final_jeopardy
  );

  const [activeClueRef, setActiveClueRef] = useState<ActiveClueRef | null>(
    null
  );

  const baseUrl = `${window.location.origin}${window.location.pathname.replace(/\/index\.html$/, '')}`;
  const buzzUrl = `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}?mode=buzz`;

  const loadStaticBoardYaml = useCallback(async () => {
    try {
      const res = await fetch('./board.yaml', { cache: 'no-store' });
      if (res.ok) {
        const yamlText = await res.text();
        const parsed = parseBoardYaml(yamlText);
        setJeopardyCategories(parsed.jeopardy);
        setDoubleJeopardyCategories(parsed.double_jeopardy);
        setFinalJeopardy(parsed.final_jeopardy);
      }
    } catch {
      // Uses bundled defaultBoardYaml fallback
    }
  }, []);

  useEffect(() => {
    if (isBuzzRoute) return;
    loadStaticBoardYaml();
  }, [isBuzzRoute, loadStaticBoardYaml]);

  if (isBuzzRoute) {
    return (
      <PlayerBuzzer
        sessionState={sessionState}
        connecting={joinStatus.connecting}
        connectedToHost={joinStatus.connectedToHost}
        joinedContestantId={joinStatus.joinedContestantId}
        joinError={joinStatus.error}
        onConnectWithPassword={playerConnectWithPassword}
        onSelectContestant={playerJoin}
        onSwitchContestant={playerLeave}
        onDisconnectSession={playerDisconnectSession}
        onBuzz={playerBuzz}
      />
    );
  }

  const handleStartGame = (
    newContestants: Contestant[],
    newPassword: string
  ) => {
    setContestants(newContestants);
    setPassword(newPassword);
    setInSetup(false);
    hostInitSession(newPassword, newContestants);
  };

  if (inSetup) {
    return (
      <SetupScreen
        initialContestants={contestants}
        initialPassword={password}
        buzzUrl={buzzUrl}
        onStartGame={handleStartGame}
      />
    );
  }

  const currentCategories =
    round === 'jeopardy' ? jeopardyCategories : doubleJeopardyCategories;

  const updateClueInState = (
    targetRound: 'jeopardy' | 'double_jeopardy',
    catIdx: number,
    qIdx: number,
    updater: (prev: ClueState) => ClueState
  ) => {
    const setter =
      targetRound === 'jeopardy'
        ? setJeopardyCategories
        : setDoubleJeopardyCategories;
    setter((prevCats) =>
      prevCats.map((cat, cIdx) => {
        if (cIdx !== catIdx) return cat;
        return {
          ...cat,
          clues: cat.clues.map((clue, clueIdx) =>
            clueIdx === qIdx ? updater(clue) : clue
          ),
        };
      })
    );
  };

  const activeClue: ClueState | null = activeClueRef
    ? (activeClueRef.round === 'jeopardy'
        ? jeopardyCategories
        : doubleJeopardyCategories)[activeClueRef.categoryIndex]?.clues[
        activeClueRef.questionIndex
      ] ?? null
    : null;

  const getLockedOutIdsForClue = (clue: ClueState): string[] => {
    return Object.entries(clue.outcomes)
      .filter(([, out]) => out === 'incorrect')
      .map(([cid]) => cid);
  };

  const handleSelectClue = (clue: ClueState, categoryTitle: string) => {
    setActiveClueRef({
      round: clue.round,
      categoryIndex: clue.categoryIndex,
      questionIndex: clue.questionIndex,
      categoryTitle,
    });

    const isPreRevealDailyDouble =
      clue.dailyDouble && !clue.ddRevealed && !clue.completed;

    if (!clue.dailyDouble && !isPreRevealDailyDouble) {
      hostOpenBuzzers(
        `${categoryTitle} ($${clue.value})`,
        getLockedOutIdsForClue(clue)
      );
    } else {
      hostLockBuzzers(true);
    }
  };

  const handleOutcomeToggle = (contestantId: string, outcome: ClueOutcome) => {
    if (!activeClue || !activeClueRef) return;

    const {
      clue: nextClue,
      contestants: nextContestants,
      newOutcome,
    } = toggleClueContestantOutcome(
      activeClue,
      contestants,
      contestantId,
      outcome
    );

    updateClueInState(
      activeClueRef.round,
      activeClueRef.categoryIndex,
      activeClueRef.questionIndex,
      () => nextClue
    );
    setContestants(nextContestants);
    hostSyncContestants(nextContestants);

    if (!nextClue.dailyDouble) {
      if (newOutcome === 'incorrect') {
        hostOpenBuzzers(
          `${activeClueRef.categoryTitle} ($${nextClue.value})`,
          getLockedOutIdsForClue(nextClue)
        );
      } else if (newOutcome === 'correct') {
        hostLockBuzzers(false);
      }
    }
  };

  const handleDailyDoubleLockWager = (
    ddContestantId: string,
    wager: number
  ) => {
    if (!activeClue || !activeClueRef) return;
    const { clue: updatedClue, contestants: updatedContestants } =
      updateDailyDoubleWager(activeClue, contestants, ddContestantId, wager);

    const revealedClue: ClueState = {
      ...updatedClue,
      ddRevealed: true,
    };

    updateClueInState(
      activeClueRef.round,
      activeClueRef.categoryIndex,
      activeClueRef.questionIndex,
      () => revealedClue
    );
    setContestants(updatedContestants);
    hostSyncContestants(updatedContestants);
  };

  const handleCompleteAndClose = () => {
    if (!activeClue || !activeClueRef) return;
    updateClueInState(
      activeClueRef.round,
      activeClueRef.categoryIndex,
      activeClueRef.questionIndex,
      (prev) => ({
        ...prev,
        completed: true,
      })
    );
    hostLockBuzzers(true);
    setActiveClueRef(null);
  };

  const handleFinalJeopardyStage = (stage: FinalJeopardyState['stage']) => {
    setFinalJeopardy((prev) => ({ ...prev, stage }));
  };

  const handleFinalJeopardyUpdateResult = (
    contestantId: string,
    wager: number,
    outcome?: ClueOutcome | null
  ) => {
    const { finalState: nextFinal, contestants: nextContestants } =
      updateFinalJeopardyResult(
        finalJeopardy,
        contestants,
        contestantId,
        wager,
        outcome
      );
    setFinalJeopardy(nextFinal);
    setContestants(nextContestants);
    hostSyncContestants(nextContestants);
  };

  const firstBuzzerId = sessionState.buzzOrder[0]?.contestantId;

  return (
    <div className="host-app">
      <header className="top-bar">
        <div className="round-tabs">
          <button
            type="button"
            className={`round-tab ${round === 'jeopardy' ? 'active' : ''}`}
            onClick={() => setRound('jeopardy')}
          >
            Jeopardy Round
          </button>
          <button
            type="button"
            className={`round-tab ${
              round === 'double_jeopardy' ? 'active' : ''
            }`}
            onClick={() => setRound('double_jeopardy')}
          >
            Double Jeopardy
          </button>
          <button
            type="button"
            className={`round-tab ${
              round === 'final_jeopardy' ? 'active' : ''
            }`}
            onClick={() => setRound('final_jeopardy')}
          >
            Final Jeopardy
          </button>
        </div>

        <div className="top-bar-right">
          <span className="join-badge">
            Buzzer: <strong>{buzzUrl}</strong> | Password:{' '}
            <strong>{password || '(none)'}</strong>
            {hostPeerStatus === 'online' && (
              <span style={{ color: '#2ecc71', marginLeft: 8 }}>● Live</span>
            )}
          </span>
          <a
            href="?mode=buzz"
            target="_blank"
            rel="noreferrer"
            className="small-btn"
            style={{ textDecoration: 'none' }}
          >
            Open Buzzer Tab ↗
          </a>
          <button
            type="button"
            className="small-btn"
            onClick={() => setInSetup(true)}
          >
            Contestants / Setup
          </button>
        </div>
      </header>

      {round === 'final_jeopardy' ? (
        <FinalJeopardy
          finalState={finalJeopardy}
          contestants={contestants}
          onSetStage={handleFinalJeopardyStage}
          onUpdateResult={handleFinalJeopardyUpdateResult}
        />
      ) : (
        <GameBoard
          categories={currentCategories}
          onSelectClue={handleSelectClue}
        />
      )}

      <footer className="scoreboard-bar">
        {contestants.map((c) => {
          const serverContestant = sessionState.contestants.find(
            (sc) => sc.id === c.id
          );
          const isConnected = Boolean(serverContestant?.connected);
          const isFirstBuzz = firstBuzzerId === c.id;

          return (
            <div
              key={c.id}
              className={`podium-card ${isFirstBuzz ? 'buzzed-first' : ''}`}
            >
              <div className="podium-header">
                <span
                  className={`connection-dot ${isConnected ? 'online' : ''}`}
                  title={
                    isConnected
                      ? 'Player buzzer connected'
                      : 'Player buzzer not connected'
                  }
                />
                <span>{c.name}</span>
              </div>
              <div
                className={`podium-score ${c.score < 0 ? 'negative' : ''}`}
              >
                {formatCurrency(c.score)}
              </div>
            </div>
          );
        })}
      </footer>

      {activeClue && activeClueRef && (
        <ClueModal
          clue={activeClue}
          categoryTitle={activeClueRef.categoryTitle}
          contestants={contestants}
          buzzOrder={sessionState.buzzOrder}
          buzzerOpen={sessionState.buzzerOpen}
          onOutcomeToggle={handleOutcomeToggle}
          onDailyDoubleLockWager={handleDailyDoubleLockWager}
          onReopenBuzzers={() =>
            hostOpenBuzzers(
              `${activeClueRef.categoryTitle} ($${activeClue.value})`,
              getLockedOutIdsForClue(activeClue)
            )
          }
          onCompleteAndClose={handleCompleteAndClose}
        />
      )}
    </div>
  );
};
