export type RoundId = 'jeopardy' | 'double_jeopardy' | 'final_jeopardy';

export interface RawClue {
  value: number;
  answer: string;
  daily_double?: boolean;
}

export interface RawCategory {
  category: string;
  questions: RawClue[];
}

export interface RawFinalJeopardy {
  category: string;
  answer: string;
}

export interface RawBoardData {
  jeopardy: RawCategory[];
  double_jeopardy: RawCategory[];
  final_jeopardy: RawFinalJeopardy;
}

export type ClueOutcome = 'correct' | 'incorrect';

export interface ClueState {
  id: string;
  round: 'jeopardy' | 'double_jeopardy';
  categoryIndex: number;
  questionIndex: number;
  value: number;
  answer: string;
  dailyDouble: boolean;
  completed: boolean;
  /**
   * Per-clue record of each contestant's outcome ('correct' | 'incorrect')
   * so re-opening a completed clue shows who was credited/docked and allows toggling.
   */
  outcomes: Record<string, ClueOutcome | undefined>;
  /**
   * Daily Double specific fields
   */
  ddContestantId?: string;
  ddWager?: number;
  ddRevealed?: boolean;
}

export interface CategoryState {
  category: string;
  clues: ClueState[];
}

export interface Contestant {
  id: string;
  name: string;
  score: number;
  connected?: boolean;
}

export interface FinalJeopardyState {
  category: string;
  answer: string;
  stage: 'category' | 'clue' | 'wagering';
  wagers: Record<string, number>;
  outcomes: Record<string, ClueOutcome | undefined>;
}

export interface TimerSettings {
  buzzerWindowEnabled: boolean;
  buzzerWindowSeconds: number;
  playerAnswerEnabled: boolean;
  playerAnswerSeconds: number;
}

export interface BuzzEntry {
  contestantId: string;
  contestantName: string;
  timestamp: number;
  deltaMs: number;
}

export interface BuzzerSessionState {
  hasSession: boolean;
  contestants: Array<{
    id: string;
    name: string;
    score: number;
    connected: boolean;
  }>;
  buzzerOpen: boolean;
  activeClueLabel: string | null;
  buzzOrder: BuzzEntry[];
  lockedOutContestantIds: string[];
}
