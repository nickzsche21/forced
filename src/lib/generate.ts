/**
 * Board generation that guarantees you never have to guess.
 *
 * The only honest way to promise this is to actually solve every candidate
 * board with the same solver the hint button uses, from the same opening click,
 * and throw away any board that stalls. A generator that merely *tries* to be
 * fair is the thing this game exists to replace.
 */

import { makeBoard, emptyView, neighbours, reveal, rng, type Board, type View } from "./board";
import { deduce } from "./solver";

export interface Generated {
  board: Board;
  /** The opening click, already guaranteed to open a clearing. */
  first: number;
  seed: number;
  attempts: number;
  /** False when we ran out of attempts and fell back to a guessable board. */
  guaranteed: boolean;
}

export interface Difficulty {
  w: number;
  h: number;
  mines: number;
  name: string;
}

export const LEVELS: Difficulty[] = [
  { name: "beginner", w: 9, h: 9, mines: 10 },
  { name: "intermediate", w: 16, h: 16, mines: 40 },
  { name: "expert", w: 30, h: 16, mines: 99 },
];

/**
 * Play the board out using only forced moves. Returns true if the whole board
 * falls to logic alone.
 */
export function solvableWithoutGuessing(board: Board, first: number): boolean {
  const v = emptyView(board.w, board.h, board.mines);
  reveal(board, v, first);

  for (;;) {
    let done = true;
    for (let i = 0; i < board.w * board.h; i++) {
      if (!board.mine[i] && v.state[i] !== "revealed") { done = false; break; }
    }
    if (done) return true;

    const moves = deduce(v);
    if (!moves.length) return false;

    let progressed = false;
    for (const d of moves) {
      for (const c of d.cells) {
        if (v.state[c] !== "hidden") continue;
        if (d.kind === "mine") {
          // The solver is only ever asked to justify itself on real boards; if
          // it flags a cell that is not a mine, generation is unsound and we
          // want to know loudly rather than ship a broken guarantee.
          if (!board.mine[c]) throw new Error(`solver flagged a safe cell at ${c}`);
          v.state[c] = "flagged";
        } else {
          if (board.mine[c]) throw new Error(`solver cleared a mine at ${c}`);
          reveal(board, v, c);
        }
        progressed = true;
      }
    }
    if (!progressed) return false;
  }
}

function placeMines(w: number, h: number, count: number, forbidden: Set<number>, rand: () => number) {
  const n = w * h;
  const pool: number[] = [];
  for (let i = 0; i < n; i++) if (!forbidden.has(i)) pool.push(i);

  // Partial Fisher-Yates: we only need the first `count` to be uniformly drawn.
  for (let k = 0; k < count; k++) {
    const j = k + Math.floor(rand() * (pool.length - k));
    [pool[k], pool[j]] = [pool[j], pool[k]];
  }
  return new Set(pool.slice(0, count));
}

export function generate(level: Difficulty, seed = Math.floor(Math.random() * 2 ** 31), maxAttempts = 400): Generated {
  const { w, h, mines } = level;
  const rand = rng(seed);

  // The opening click and its neighbours are kept clear so the first move
  // always opens a clearing rather than a lone number.
  const first = Math.floor(rand() * w * h);
  const forbidden = new Set<number>([first, ...neighbours(w, h, first)]);

  const usable = w * h - forbidden.size;
  const count = Math.min(mines, usable);

  let fallback: Board | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const board = makeBoard(w, h, placeMines(w, h, count, forbidden, rand));
    fallback ??= board;
    if (solvableWithoutGuessing(board, first)) {
      return { board, first, seed, attempts: attempt, guaranteed: true };
    }
  }
  return { board: fallback!, first, seed, attempts: maxAttempts, guaranteed: false };
}
