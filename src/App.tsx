import React, { useEffect, useMemo, useState } from 'react';
import { ClueModal } from './components/ClueModal';
import { FinalJeopardy } from './components/FinalJeopardy';
import { GameBoard } from './components/GameBoard';
import { LandingPage } from './components/LandingPage';
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
  TimerSettings,
} from './types/game';
import { getAvailableBoards } from './utils/boardLoader';
import {
  formatCurrency,
  parseBoardYaml,
  toggleClueContestantOutcome,
  updateDailyDoubleWager,
  updateFinalJeopardyResult,
} from './utils/gameLogic';

const STORAGE_KEY = 'jeopardy_saved_state_v1';

const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  buzzerWindowEnabled: true,
  buzzerWindowSeconds: 5,
  playerAnswerEnabled: true,
  playerAnswerSeconds: 5,
};

interface SavedGameState {
  hasGameInProgress: boolean;
  selectedBoardFilename: string;
  password: string;
  timerSettings: TimerSettings;
  round: RoundId;
  contestants: Contestant[];
  jeopardyCategories: CategoryState[];
  doubleJeopardyCategories: CategoryState[];
  finalJeopardy: FinalJeopardyState;
}

interface ActiveClueRef {
  round: 'jeopardy' | 'double_jeopardy';
  categoryIndex: number;
  questionIndex: number;
  categoryTitle: string;
}

type ViewMode = 'home' | 'host_setup' | 'host_game' | 'join';

function loadSavedState(): SavedGameState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedGameState;
  } catch {
    return null;
  }
}

export const App: React.FC = () => {
  const availableBoards = useMemo(() => getAvailableBoards(), []);
  const saved = useMemo(() => loadSavedState(), []);

  const initialIsDirectBuzzUrl =
    new URLSearchParams(window.location.search).get('mode') === 'buzz' ||
    window.location.hash === '#/buzz' ||
    window.location.pathname.endsWith('/buzz');

  const [viewMode, setViewMode] = useState<ViewMode>(
    initialIsDirectBuzzUrl ? 'join' : 'home'
  );

  const [hasGameInProgress, setHasGameInProgress] = useState<boolean>(
    saved?.hasGameInProgress ?? false
  );
  const [selectedBoardFilename, setSelectedBoardFilename] = useState<string>(
    saved?.selectedBoardFilename || availableBoards[0]?.filename || 'board.yaml'
  );
  const [password, setPassword] = useState<string>(
    saved?.password ?? 'jeopardy'
  );
  const [timerSettings, setTimerSettings] = useState<TimerSettings>(
    saved?.timerSettings ?? DEFAULT_TIMER_SETTINGS
  );
  const [contestants, setContestants] = useState<Contestant[]>(
    saved?.contestants ?? [
      { id: 'player-1', name: 'Player 1', score: 0 },
      { id: 'player-2', name: 'Player 2', score: 0 },
      { id: 'player-3', name: 'Player 3', score: 0 },
    ]
  );

  const defaultParsedBoard = useMemo(() => {
    const entry =
      availableBoards.find((b) => b.filename === selectedBoardFilename) ??
      availableBoards[0];
    return parseBoardYaml(entry?.content ?? '');
  }, [availableBoards, selectedBoardFilename]);

  const [round, setRound] = useState<RoundId>(saved?.round ?? 'jeopardy');
  const [jeopardyCategories, setJeopardyCategories] = useState<CategoryState[]>(
    () => saved?.jeopardyCategories ?? defaultParsedBoard.jeopardy
  );
  const [doubleJeopardyCategories, setDoubleJeopardyCategories] = useState<
    CategoryState[]
  >(() => saved?.doubleJeopardyCategories ?? defaultParsedBoard.double_jeopardy);
  const [finalJeopardy, setFinalJeopardy] = useState<FinalJeopardyState>(
    () => saved?.finalJeopardy ?? defaultParsedBoard.final_jeopardy
  );

  const [activeClueRef, setActiveClueRef] = useState<ActiveClueRef | null>(
    null
  );

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

  // Persist game state and scores whenever state updates
  useEffect(() => {
    try {
      const stateToSave: SavedGameState = {
        hasGameInProgress,
        selectedBoardFilename,
        password,
        timerSettings,
        round,
        contestants,
        jeopardyCategories,
        doubleJeopardyCategories,
        finalJeopardy,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    hasGameInProgress,
    selectedBoardFilename,
    password,
    timerSettings,
    round,
    contestants,
    jeopardyCategories,
    doubleJeopardyCategories,
    finalJeopardy,
  ]);

  if (viewMode === 'home') {
    return (
      <LandingPage
        hasGameInProgress={hasGameInProgress}
        onSelectHost={() => setViewMode('host_setup')}
        onSelectJoin={() => setViewMode('join')}
      />
    );
  }

  if (viewMode === 'join') {
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
        onBackToHome={() => {
          playerDisconnectSession();
          setViewMode('home');
        }}
      />
    );
  }

  const handleSaveSetup = (options: {
    boardFilename: string;
    contestants: Contestant[];
    password: string;
    timerSettings: TimerSettings;
    resetBoardAndScores: boolean;
  }) => {
    setSelectedBoardFilename(options.boardFilename);
    setContestants(options.contestants);
    setPassword(options.password);
    setTimerSettings(options.timerSettings);

    if (options.resetBoardAndScores || !hasGameInProgress) {
      const boardEntry =
        availableBoards.find((b) => b.filename === options.boardFilename) ??
        availableBoards[0];
      const parsed = parseBoardYaml(boardEntry?.content ?? '');
      setJeopardyCategories(parsed.jeopardy);
      setDoubleJeopardyCategories(parsed.double_jeopardy);
      setFinalJeopardy(parsed.final_jeopardy);
      setRound('jeopardy');
    }

    setHasGameInProgress(true);
    setViewMode('host_game');
    hostInitSession(options.password, options.contestants);
  };

  if (viewMode === 'host_setup') {
    return (
      <SetupScreen
        availableBoards={availableBoards}
        selectedBoardFilename={selectedBoardFilename}
        initialContestants={contestants}
        initialPassword={password}
        initialTimerSettings={timerSettings}
        hasGameInProgress={hasGameInProgress}
        onSaveSetup={handleSaveSetup}
        onBackToHome={() => setViewMode('home')}
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

  // When an answer is revealed, buzzers are NOT active right away — host clicks "Enable Buzzers" after reading aloud
  const handleSelectClue = (clue: ClueState, categoryTitle: string) => {
    setActiveClueRef({
      round: clue.round,
      categoryIndex: clue.categoryIndex,
      questionIndex: clue.questionIndex,
      categoryTitle,
    });
    hostLockBuzzers(true);
  };

  const handleEnableBuzzers = () => {
    if (!activeClue || !activeClueRef) return;
    hostOpenBuzzers(
      `${activeClueRef.categoryTitle} ($${activeClue.value})`,
      getLockedOutIdsForClue(activeClue)
    );
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
      const lockedOutIds = getLockedOutIdsForClue(nextClue);
      if (newOutcome === 'incorrect') {
        // Immediately activate buzzers for remaining eligible players
        if (lockedOutIds.length < nextContestants.length) {
          hostOpenBuzzers(
            `${activeClueRef.categoryTitle} ($${nextClue.value})`,
            lockedOutIds
          );
        } else {
          hostLockBuzzers(true);
        }
      } else if (newOutcome === 'correct') {
        hostLockBuzzers(true);
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
            Board: <strong>{selectedBoardFilename}</strong> | Password:{' '}
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
            onClick={() => setViewMode('host_setup')}
          >
            Setup
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
          timerSettings={timerSettings}
          onOutcomeToggle={handleOutcomeToggle}
          onDailyDoubleLockWager={handleDailyDoubleLockWager}
          onEnableBuzzers={handleEnableBuzzers}
          onLockBuzzers={() => hostLockBuzzers(false)}
          onCompleteAndClose={handleCompleteAndClose}
        />
      )}
    </div>
  );
};
