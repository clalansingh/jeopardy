import YAML from 'yaml';
import type {
  CategoryState,
  ClueOutcome,
  ClueState,
  Contestant,
  FinalJeopardyState,
  RawBoardData,
  RawCategory,
} from '../types/game';

export interface ParsedGameData {
  jeopardy: CategoryState[];
  double_jeopardy: CategoryState[];
  final_jeopardy: FinalJeopardyState;
}

function buildRoundCategories(
  rawCategories: RawCategory[] | undefined,
  round: 'jeopardy' | 'double_jeopardy',
  defaultBaseValue: number
): CategoryState[] {
  const categories = Array.isArray(rawCategories) ? rawCategories : [];
  return Array.from({ length: 6 }, (_, catIdx) => {
    const rawCat = categories[catIdx];
    const rawQuestions = Array.isArray(rawCat?.questions) ? rawCat.questions : [];
    const clues: ClueState[] = Array.from({ length: 5 }, (__, qIdx) => {
      const rawQ = rawQuestions[qIdx];
      const value =
        typeof rawQ?.value === 'number'
          ? rawQ.value
          : defaultBaseValue * (qIdx + 1);
      return {
        id: `${round}-${catIdx}-${qIdx}`,
        round,
        categoryIndex: catIdx,
        questionIndex: qIdx,
        value,
        answer: typeof rawQ?.answer === 'string' ? rawQ.answer : '',
        dailyDouble: Boolean(rawQ?.daily_double ?? false),
        completed: false,
        outcomes: {},
      };
    });
    return {
      category: typeof rawCat?.category === 'string' ? rawCat.category : '',
      clues,
    };
  });
}

export function parseBoardYaml(yamlText: string): ParsedGameData {
  const parsed = (YAML.parse(yamlText) ?? {}) as Partial<RawBoardData>;

  return {
    jeopardy: buildRoundCategories(parsed.jeopardy, 'jeopardy', 100),
    double_jeopardy: buildRoundCategories(
      parsed.double_jeopardy,
      'double_jeopardy',
      200
    ),
    final_jeopardy: {
      category:
        typeof parsed.final_jeopardy?.category === 'string'
          ? parsed.final_jeopardy.category
          : '',
      answer:
        typeof parsed.final_jeopardy?.answer === 'string'
          ? parsed.final_jeopardy.answer
          : '',
      stage: 'category',
      wagers: {},
      outcomes: {},
    },
  };
}

export function getOutcomePoints(
  outcome: ClueOutcome | undefined,
  amount: number
): number {
  if (outcome === 'correct') return amount;
  if (outcome === 'incorrect') return -amount;
  return 0;
}

/**
 * Toggles or switches a contestant's outcome ('correct' | 'incorrect') on a clue
 * and returns the updated clue and updated contestants list with reconciled scores.
 */
export function toggleClueContestantOutcome(
  clue: ClueState,
  contestants: Contestant[],
  contestantId: string,
  targetOutcome: ClueOutcome
): { clue: ClueState; contestants: Contestant[]; newOutcome: ClueOutcome | undefined } {
  const amount = clue.dailyDouble ? (clue.ddWager ?? 0) : clue.value;
  const prevOutcome = clue.outcomes[contestantId];
  const nextOutcome: ClueOutcome | undefined =
    prevOutcome === targetOutcome ? undefined : targetOutcome;

  const prevDelta = getOutcomePoints(prevOutcome, amount);
  const nextDelta = getOutcomePoints(nextOutcome, amount);
  const scoreAdjustment = nextDelta - prevDelta;

  const updatedOutcomes = { ...clue.outcomes };
  if (nextOutcome === undefined) {
    delete updatedOutcomes[contestantId];
  } else {
    updatedOutcomes[contestantId] = nextOutcome;
  }

  const updatedClue: ClueState = {
    ...clue,
    outcomes: updatedOutcomes,
  };

  const updatedContestants = contestants.map((c) =>
    c.id === contestantId ? { ...c, score: c.score + scoreAdjustment } : c
  );

  return {
    clue: updatedClue,
    contestants: updatedContestants,
    newOutcome: nextOutcome,
  };
}

/**
 * Updates the Daily Double contestant and/or wager, reconciling scores if an outcome
 * was already applied (e.g. when reviewing a completed Daily Double clue).
 */
export function updateDailyDoubleWager(
  clue: ClueState,
  contestants: Contestant[],
  ddContestantId: string,
  ddWager: number
): { clue: ClueState; contestants: Contestant[] } {
  const sanitizedWager = Math.max(0, Math.floor(ddWager || 0));
  let updatedContestants = [...contestants];
  let updatedOutcomes = { ...clue.outcomes };

  // If a previous contestant had an outcome on this DD clue, revert their points first
  for (const [cid, outcome] of Object.entries(clue.outcomes)) {
    if (outcome) {
      const prevPoints = getOutcomePoints(outcome, clue.ddWager ?? 0);
      updatedContestants = updatedContestants.map((c) =>
        c.id === cid ? { ...c, score: c.score - prevPoints } : c
      );
    }
  }

  // If the DD contestant changed, clear old outcomes; if same contestant, re-apply with new wager
  if (clue.ddContestantId && clue.ddContestantId !== ddContestantId) {
    updatedOutcomes = {};
  } else if (updatedOutcomes[ddContestantId]) {
    const newPoints = getOutcomePoints(
      updatedOutcomes[ddContestantId],
      sanitizedWager
    );
    updatedContestants = updatedContestants.map((c) =>
      c.id === ddContestantId ? { ...c, score: c.score + newPoints } : c
    );
  }

  const updatedClue: ClueState = {
    ...clue,
    ddContestantId,
    ddWager: sanitizedWager,
    outcomes: updatedOutcomes,
  };

  return { clue: updatedClue, contestants: updatedContestants };
}

/**
 * Final Jeopardy: updates a contestant's wager or outcome ('correct' | 'incorrect')
 * and reconciles their total score.
 */
export function updateFinalJeopardyResult(
  finalState: FinalJeopardyState,
  contestants: Contestant[],
  contestantId: string,
  wager: number,
  targetOutcome?: ClueOutcome | null
): { finalState: FinalJeopardyState; contestants: Contestant[] } {
  const sanitizedWager = Math.max(0, Math.floor(wager || 0));
  const prevWager = finalState.wagers[contestantId] ?? 0;
  const prevOutcome = finalState.outcomes[contestantId];

  let nextOutcome = prevOutcome;
  if (targetOutcome !== undefined) {
    if (targetOutcome === null || prevOutcome === targetOutcome) {
      nextOutcome = undefined;
    } else {
      nextOutcome = targetOutcome;
    }
  }

  const prevPoints = getOutcomePoints(prevOutcome, prevWager);
  const nextPoints = getOutcomePoints(nextOutcome, sanitizedWager);
  const diff = nextPoints - prevPoints;

  const updatedWagers = {
    ...finalState.wagers,
    [contestantId]: sanitizedWager,
  };
  const updatedOutcomes = { ...finalState.outcomes };
  if (nextOutcome === undefined) {
    delete updatedOutcomes[contestantId];
  } else {
    updatedOutcomes[contestantId] = nextOutcome;
  }

  return {
    finalState: {
      ...finalState,
      wagers: updatedWagers,
      outcomes: updatedOutcomes,
    },
    contestants: contestants.map((c) =>
      c.id === contestantId ? { ...c, score: c.score + diff } : c
    ),
  };
}

export function formatCurrency(amount: number): string {
  const abs = Math.abs(amount).toLocaleString('en-US');
  return amount < 0 ? `-$${abs}` : `$${abs}`;
}
