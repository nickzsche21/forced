/** Board state and the plain mechanics. No solving here — that lives in solver.ts. */

export interface Board {
  w: number;
  h: number;
  mines: number;
  /** true where a mine sits. */
  mine: boolean[];
  /** neighbouring mine count, meaningless on mine cells. */
  adj: number[];
}

export type CellState = "hidden" | "revealed" | "flagged";

export interface View {
  w: number;
  h: number;
  mines: number;
  state: CellState[];
  /** Revealed numbers. -1 where not revealed. */
  num: number[];
}

export const idx = (w: number, x: number, y: number) => y * w + x;
export const xy = (w: number, i: number) => [i % w, Math.floor(i / w)] as const;

export function neighbours(w: number, h: number, i: number): number[] {
  const [x, y] = xy(w, i);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      out.push(idx(w, nx, ny));
    }
  }
  return out;
}

export function makeBoard(w: number, h: number, minePositions: Set<number>): Board {
  const n = w * h;
  const mine = new Array<boolean>(n).fill(false);
  for (const i of minePositions) mine[i] = true;
  const adj = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (mine[i]) continue;
    let c = 0;
    for (const j of neighbours(w, h, i)) if (mine[j]) c++;
    adj[i] = c;
  }
  return { w, h, mines: minePositions.size, mine, adj };
}

export function emptyView(w: number, h: number, mines: number): View {
  return {
    w, h, mines,
    state: new Array<CellState>(w * h).fill("hidden"),
    num: new Array<number>(w * h).fill(-1),
  };
}

/**
 * Reveal a cell, flood-filling through zeroes the way the original does.
 * Returns the indices newly revealed. Revealing a mine returns it and the
 * caller decides what that means.
 */
export function reveal(board: Board, view: View, start: number): number[] {
  if (view.state[start] !== "hidden") return [];
  const opened: number[] = [];
  const stack = [start];

  while (stack.length) {
    const i = stack.pop()!;
    if (view.state[i] !== "hidden") continue;
    view.state[i] = "revealed";
    view.num[i] = board.mine[i] ? -2 : board.adj[i];
    opened.push(i);
    if (!board.mine[i] && board.adj[i] === 0) {
      for (const j of neighbours(board.w, board.h, i)) {
        if (view.state[j] === "hidden") stack.push(j);
      }
    }
  }
  return opened;
}

export function isWon(board: Board, view: View): boolean {
  for (let i = 0; i < board.w * board.h; i++) {
    if (!board.mine[i] && view.state[i] !== "revealed") return false;
  }
  return true;
}

/** A seeded PRNG so a board can be shared by its seed and replayed exactly. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
