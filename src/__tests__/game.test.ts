import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeCountdownSegments } from '../components/PodiumCountdown';
import { getAvailableBoards } from '../utils/boardLoader';
import { BuzzerManager, deriveHostPeerId } from '../utils/buzzerManager';
import {
  parseBoardYaml,
  toggleClueContestantOutcome,
  updateDailyDoubleWager,
  updateFinalJeopardyResult,
} from '../utils/gameLogic';

describe('YAML Board Parser & /boards Loader', () => {
  it('discovers multiple board files in the /boards directory', () => {
    const boards = getAvailableBoards();
    const filenames = boards.map((b) => b.filename);
    expect(filenames).toContain('board.yaml');
    expect(filenames).toContain('popculture.yml');
  });

  it('parses the skeleton board.yaml with 6 categories and 5 clues per round and defaults daily_double to false', () => {
    const yamlContent = fs.readFileSync(
      path.resolve(process.cwd(), 'boards/board.yaml'),
      'utf-8'
    );
    const data = parseBoardYaml(yamlContent);

    expect(data.jeopardy).toHaveLength(6);
    expect(data.double_jeopardy).toHaveLength(6);

    for (const cat of data.jeopardy) {
      expect(cat.clues).toHaveLength(5);
      expect(cat.clues.map((c) => c.value)).toEqual([100, 200, 300, 400, 500]);
      for (const clue of cat.clues) {
        expect(clue.dailyDouble).toBe(false);
      }
    }

    for (const cat of data.double_jeopardy) {
      expect(cat.clues).toHaveLength(5);
      expect(cat.clues.map((c) => c.value)).toEqual([200, 400, 600, 800, 1000]);
      for (const clue of cat.clues) {
        expect(clue.dailyDouble).toBe(false);
      }
    }
  });

  it('respects daily_double: true when provided in YAML', () => {
    const customYaml = `
jeopardy:
  - category: "History"
    questions:
      - value: 100
        answer: "First clue"
      - value: 200
        answer: "Daily double clue"
        daily_double: true
`;
    const parsed = parseBoardYaml(customYaml);
    expect(parsed.jeopardy[0].category).toBe('History');
    expect(parsed.jeopardy[0].clues[0].dailyDouble).toBe(false);
    expect(parsed.jeopardy[0].clues[1].dailyDouble).toBe(true);
  });
});

describe('Podium Countdown Segmented Bar (podium-countdown.png)', () => {
  it('ticks inward symmetrically from both sides from red (true) to black (false)', () => {
    // 5 seconds remaining: all 9 segments lit
    expect(computeCountdownSegments(5, 5)).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ]);

    // 4 seconds remaining (1s elapsed): 1 black on left & right, 7 lit in center
    expect(computeCountdownSegments(5, 4)).toEqual([
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      false,
    ]);

    // 3 seconds remaining (2s elapsed): 2 black on left & right, 5 lit in center (matches podium-countdown.png)
    expect(computeCountdownSegments(5, 3)).toEqual([
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      false,
      false,
    ]);

    // 1 second remaining (4s elapsed): only center segment lit
    expect(computeCountdownSegments(5, 1)).toEqual([
      false,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      false,
    ]);

    // 0 seconds remaining: all 9 segments dark/black
    expect(computeCountdownSegments(5, 0)).toEqual(Array(9).fill(false));
  });
});

describe('Reversible Per-Clue Scoring & Completed Clue Review', () => {
  it('credits, docks, toggles off, and switches contestant outcomes cleanly', () => {
    const parsed = parseBoardYaml('');
    let clue = parsed.jeopardy[0].clues[1]; // $200 clue
    let contestants = [
      { id: 'p1', name: 'Alice', score: 0 },
      { id: 'p2', name: 'Bob', score: 0 },
    ];

    // 1. Alice buzzes in and answers incorrectly (-$200)
    let res = toggleClueContestantOutcome(clue, contestants, 'p1', 'incorrect');
    clue = res.clue;
    contestants = res.contestants;
    expect(contestants[0].score).toBe(-200);
    expect(clue.outcomes['p1']).toBe('incorrect');

    // 2. Bob buzzes in and answers correctly (+$200)
    res = toggleClueContestantOutcome(clue, contestants, 'p2', 'correct');
    clue = res.clue;
    contestants = res.contestants;
    expect(contestants[1].score).toBe(200);
    expect(clue.outcomes['p2']).toBe('correct');

    // 3. Host re-opens the completed clue and realizes Alice was actually right:
    // Switching Alice from 'incorrect' to 'correct' adds +400 (from -200 to +200)
    res = toggleClueContestantOutcome(clue, contestants, 'p1', 'correct');
    clue = res.clue;
    contestants = res.contestants;
    expect(contestants[0].score).toBe(200);
    expect(clue.outcomes['p1']).toBe('correct');

    // 4. Host un-credits Bob by clicking Bob's active 'correct' button
    res = toggleClueContestantOutcome(clue, contestants, 'p2', 'correct');
    clue = res.clue;
    contestants = res.contestants;
    expect(contestants[1].score).toBe(0);
    expect(clue.outcomes['p2']).toBeUndefined();
  });

  it('handles Daily Double wagers and outcome adjustments', () => {
    const parsed = parseBoardYaml('');
    let clue = { ...parsed.jeopardy[0].clues[3], dailyDouble: true }; // $400 DD
    let contestants = [
      { id: 'p1', name: 'Alice', score: 1000 },
      { id: 'p2', name: 'Bob', score: 600 },
    ];

    // Alice wagers $800
    const ddSetup = updateDailyDoubleWager(clue, contestants, 'p1', 800);
    clue = ddSetup.clue;
    contestants = ddSetup.contestants;

    // Alice gets it right (+800 -> 1800)
    const afterCorrect = toggleClueContestantOutcome(
      clue,
      contestants,
      'p1',
      'correct'
    );
    clue = afterCorrect.clue;
    contestants = afterCorrect.contestants;
    expect(contestants[0].score).toBe(1800);

    // If host reviews DD and adjusts wager to $500, Alice's score updates to 1500
    const afterWagerEdit = updateDailyDoubleWager(clue, contestants, 'p1', 500);
    expect(afterWagerEdit.contestants[0].score).toBe(1500);
  });

  it('calculates Final Jeopardy wagers and outcomes accurately', () => {
    const parsed = parseBoardYaml('');
    let fj = parsed.final_jeopardy;
    let contestants = [
      { id: 'p1', name: 'Alice', score: 2000 },
      { id: 'p2', name: 'Bob', score: 1500 },
    ];

    let step1 = updateFinalJeopardyResult(fj, contestants, 'p1', 1200, 'correct');
    fj = step1.finalState;
    contestants = step1.contestants;
    expect(contestants[0].score).toBe(3200);

    let step2 = updateFinalJeopardyResult(
      fj,
      contestants,
      'p2',
      1500,
      'incorrect'
    );
    fj = step2.finalState;
    contestants = step2.contestants;
    expect(contestants[1].score).toBe(0);
  });
});

describe('BuzzerManager Sequential Buzzer & Lockout Flow', () => {
  it('derives deterministic URL-safe PeerJS IDs from the session password', () => {
    const id1 = deriveHostPeerId('GameNight2026');
    const id2 = deriveHostPeerId('  gamenight2026 ');
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^jeopardy-host-gamenight2026-[0-9a-f]{8}$/);
  });

  it('keeps buzzers locked until enabled, locks on buzz-in, and re-activates excluding wrong players', () => {
    const manager = new BuzzerManager();
    manager.initSession('secret123', [
      { id: 'p1', name: 'Alice', score: 0 },
      { id: 'p2', name: 'Bob', score: 0 },
    ]);

    expect(manager.verifyJoin('p1', 'wrong').ok).toBe(false);
    expect(manager.verifyJoin('p1', 'secret123').ok).toBe(true);

    // 1. Buzzers start locked before host finishes reading clue aloud
    expect(manager.getState().buzzerOpen).toBe(false);
    expect(manager.recordBuzz('p1', 100)).toBe(false);

    // 2. Host clicks "Enable Buzzers" -> opens buzzers
    manager.openBuzzers('HISTORY ($200)');
    expect(manager.getState().buzzerOpen).toBe(true);

    // 3. Bob buzzes in first -> locks buzzers immediately while Bob answers
    expect(manager.recordBuzz('p2', 1000)).toBe(true);
    expect(manager.getState().buzzerOpen).toBe(false);
    expect(manager.getState().buzzOrder[0].contestantId).toBe('p2');
    expect(manager.recordBuzz('p1', 1045)).toBe(false);

    // 4. Bob answers wrong -> host clicks -$200, which immediately re-opens buzzers with Bob locked out
    manager.openBuzzers('HISTORY ($200)', ['p2']);
    expect(manager.getState().buzzerOpen).toBe(true);
    expect(manager.recordBuzz('p2', 2000)).toBe(false); // Bob cannot buzz in again for same clue
    expect(manager.recordBuzz('p1', 2010)).toBe(true); // Alice can buzz in
    expect(manager.getState().buzzOrder[0].contestantId).toBe('p1');

    // 5. If Alice also answers wrong, all contestants are locked out so buzzers stay closed
    manager.openBuzzers('HISTORY ($200)', ['p2', 'p1']);
    expect(manager.getState().buzzerOpen).toBe(false);
  });
});
