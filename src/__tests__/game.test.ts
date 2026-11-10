import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BuzzerManager, deriveHostPeerId } from '../utils/buzzerManager';
import {
  parseBoardYaml,
  toggleClueContestantOutcome,
  updateDailyDoubleWager,
  updateFinalJeopardyResult,
} from '../utils/gameLogic';

describe('YAML Board Parser', () => {
  it('parses the skeleton board.yaml with 6 categories and 5 clues per round and defaults daily_double to false', () => {
    const yamlContent = fs.readFileSync(
      path.resolve(process.cwd(), 'board.yaml'),
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

describe('BuzzerManager Session & PeerJS ID Derivation', () => {
  it('derives deterministic URL-safe PeerJS IDs from the session password', () => {
    const id1 = deriveHostPeerId('GameNight2026');
    const id2 = deriveHostPeerId('  gamenight2026 ');
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^jeopardy-host-gamenight2026-[0-9a-f]{8}$/);
  });

  it('validates session password, orders buzzes by timestamp, and locks out wrong players on re-open', () => {
    const manager = new BuzzerManager();
    manager.initSession('secret123', [
      { id: 'p1', name: 'Alice', score: 0 },
      { id: 'p2', name: 'Bob', score: 0 },
    ]);

    expect(manager.verifyJoin('p1', 'wrong').ok).toBe(false);
    expect(manager.verifyJoin('p1', 'secret123').ok).toBe(true);

    // Buzzers locked initially
    expect(manager.recordBuzz('p1', 100)).toBe(false);

    // Host reveals clue -> opens buzzers
    manager.openBuzzers('HISTORY ($200)');
    expect(manager.recordBuzz('p2', 1000)).toBe(true);
    expect(manager.recordBuzz('p1', 1045)).toBe(true);

    const state = manager.getState();
    expect(state.buzzOrder).toHaveLength(2);
    expect(state.buzzOrder[0].contestantId).toBe('p2');
    expect(state.buzzOrder[0].deltaMs).toBe(0);
    expect(state.buzzOrder[1].contestantId).toBe('p1');
    expect(state.buzzOrder[1].deltaMs).toBe(45);

    // Suppose Bob (p2) answers wrong -> host re-opens buzzers with p2 locked out
    manager.openBuzzers('HISTORY ($200)', ['p2']);
    expect(manager.recordBuzz('p2', 2000)).toBe(false);
    expect(manager.recordBuzz('p1', 2010)).toBe(true);
    expect(manager.getState().buzzOrder[0].contestantId).toBe('p1');
  });
});
