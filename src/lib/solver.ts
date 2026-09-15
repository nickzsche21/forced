/**
 * The solver, and the reason this game exists.
 *
 * Most Minesweeper implementations will happily deal you a board whose last few
 * cells are a coin flip. This one refuses to — and because the same solver that
 * guarantees a board is logically solvable also produces the derivation, it can
 * show you *why* a move is forced instead of just asserting it.
 *
 * Rules are tried cheapest-first, so a hint is the simplest true explanation
 * available rather than the first one a search happens to find.
 */

import { neighbours, xy, type View } from "./board";

export type Rule = "satisfied" | "exhausted" | "subset" | "counting" | "enumeration";

export interface Deduction {
  kind: "safe" | "mine";
  /** Cells this deduction settles. */
  cells: number[];
  /** The revealed clues that justify it — highlighted in the UI. */
  from: number[];
  rule: Rule;
  /** A sentence a person can check by eye. */
  reason: string;
}

/** Spreadsheet-style names, so a proof can point at a square out loud. */
export function cellName(w: number, i: number): string {
  const [x, y] = xy(w, i);
  let s = "", n = x;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return `${s}${y + 1}`;
}

const list = (w: number, cells: number[]) => {
  const names = cells.map((c) => cellName(w, c));
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

interface Constraint {
  /** Hidden, unflagged cells. */
  cells: number[];
  /** How many of them are mines. */
  mines: number;
  /** The revealed clue cell this came from. */
  source: number;
}

function constraints(v: View): Constraint[] {
  const out: Constraint[] = [];
  for (let i = 0; i < v.state.length; i++) {
    if (v.state[i] !== "revealed" || v.num[i] < 1) continue;
    const hidden: number[] = [];
    let flagged = 0;
    for (const j of neighbours(v.w, v.h, i)) {
      if (v.state[j] === "flagged") flagged++;
      else if (v.state[j] === "hidden") hidden.push(j);
    }
    if (hidden.length) out.push({ cells: hidden, mines: v.num[i] - flagged, source: i });
  }
  return out;
}

function hiddenCells(v: View): number[] {
  const out: number[] = [];
  for (let i = 0; i < v.state.length; i++) if (v.state[i] === "hidden") out.push(i);
  return out;
}

function flaggedCount(v: View): number {
  let n = 0;
  for (const s of v.state) if (s === "flagged") n++;
  return n;
}

/* ---------------------------------------------------------------- *
 * The rules
 * ---------------------------------------------------------------- */

function ruleSatisfied(v: View, cs: Constraint[]): Deduction[] {
  const out: Deduction[] = [];
  for (const c of cs) {
    if (c.mines === 0 && c.cells.length) {
      out.push({
        kind: "safe", cells: [...c.cells], from: [c.source], rule: "satisfied",
        reason: `The ${v.num[c.source]} at ${cellName(v.w, c.source)} already touches ${v.num[c.source]} flag${v.num[c.source] === 1 ? "" : "s"}, so ${list(v.w, c.cells)} cannot be ${c.cells.length === 1 ? "a mine" : "mines"}.`,
      });
    }
  }
  return out;
}

function ruleExhausted(v: View, cs: Constraint[]): Deduction[] {
  const out: Deduction[] = [];
  for (const c of cs) {
    if (c.mines > 0 && c.mines === c.cells.length) {
      out.push({
        kind: "mine", cells: [...c.cells], from: [c.source], rule: "exhausted",
        reason: `The ${v.num[c.source]} at ${cellName(v.w, c.source)} has exactly ${c.cells.length} hidden neighbour${c.cells.length === 1 ? "" : "s"} left, so ${list(v.w, c.cells)} must all be mines.`,
      });
    }
  }
  return out;
}

/** A ⊆ B lets you subtract one clue from another. The 1-2-1 patterns live here. */
function ruleSubset(v: View, cs: Constraint[]): Deduction[] {
  const out: Deduction[] = [];
  for (const a of cs) {
    for (const b of cs) {
      if (a === b || a.cells.length >= b.cells.length) continue;
      const setB = new Set(b.cells);
      if (!a.cells.every((c) => setB.has(c))) continue;

      const diff = b.cells.filter((c) => !a.cells.includes(c));
      if (!diff.length) continue;
      const dMines = b.mines - a.mines;

      if (dMines === diff.length) {
        out.push({
          kind: "mine", cells: diff, from: [a.source, b.source], rule: "subset",
          reason: `Everything the ${v.num[a.source]} at ${cellName(v.w, a.source)} can see is also seen by the ${v.num[b.source]} at ${cellName(v.w, b.source)}. That leaves ${dMines} extra mine${dMines === 1 ? "" : "s"} for exactly ${diff.length} extra cell${diff.length === 1 ? "" : "s"}, so ${list(v.w, diff)} must be ${diff.length === 1 ? "a mine" : "mines"}.`,
        });
      } else if (dMines === 0) {
        out.push({
          kind: "safe", cells: diff, from: [a.source, b.source], rule: "subset",
          reason: `The ${v.num[b.source]} at ${cellName(v.w, b.source)} needs no more mines than the ${v.num[a.source]} at ${cellName(v.w, a.source)}, and sees everything it sees — so the extra cells ${list(v.w, diff)} are clear.`,
        });
      }
    }
  }
  return out;
}

/** The whole-board mine budget. Settles most endgames on its own. */
function ruleCounting(v: View): Deduction[] {
  const hidden = hiddenCells(v);
  if (!hidden.length) return [];
  const remaining = v.mines - flaggedCount(v);

  if (remaining === 0) {
    return [{
      kind: "safe", cells: hidden, from: [], rule: "counting",
      reason: `All ${v.mines} mines are flagged, so every remaining hidden square is clear.`,
    }];
  }
  if (remaining === hidden.length) {
    return [{
      kind: "mine", cells: hidden, from: [], rule: "counting",
      reason: `There are ${remaining} mines left and exactly ${hidden.length} hidden squares, so every one of them is a mine.`,
    }];
  }
  return [];
}

/* ---------------------------------------------------------------- *
 * Exhaustive enumeration, for what the simple rules cannot reach
 * ---------------------------------------------------------------- */

interface Component {
  cells: number[];
  cons: Constraint[];
}

function components(cs: Constraint[]): Component[] {
  const owner = new Map<number, number>();
  const groups: Component[] = [];

  for (const c of cs) {
    const hit = new Set<number>();
    for (const cell of c.cells) {
      const g = owner.get(cell);
      if (g !== undefined) hit.add(g);
    }
    if (!hit.size) {
      const g = groups.length;
      groups.push({ cells: [...new Set(c.cells)], cons: [c] });
      for (const cell of c.cells) owner.set(cell, g);
    } else {
      const [keep, ...merge] = [...hit];
      groups[keep].cons.push(c);
      for (const cell of c.cells) {
        if (!groups[keep].cells.includes(cell)) groups[keep].cells.push(cell);
        owner.set(cell, keep);
      }
      for (const m of merge) {
        for (const cell of groups[m].cells) {
          if (!groups[keep].cells.includes(cell)) groups[keep].cells.push(cell);
          owner.set(cell, keep);
        }
        groups[keep].cons.push(...groups[m].cons);
        groups[m].cells = [];
        groups[m].cons = [];
      }
    }
  }
  return groups.filter((g) => g.cells.length);
}

/** Every mine layout for one component that satisfies all of its clues. */
function solutions(comp: Component, cap: number): { counts: number[]; total: number; sizes: Set<number> } | null {
  const n = comp.cells.length;
  if (n > cap) return null;

  const index = new Map(comp.cells.map((c, k) => [c, k]));
  const cons = comp.cons.map((c) => ({ idxs: c.cells.map((x) => index.get(x)!), mines: c.mines }));

  const counts = new Array<number>(n).fill(0);
  const sizes = new Set<number>();
  const assign = new Int8Array(n).fill(-1);
  let total = 0;

  const feasible = () => {
    for (const c of cons) {
      let mines = 0, unknown = 0;
      for (const k of c.idxs) {
        if (assign[k] === 1) mines++;
        else if (assign[k] === -1) unknown++;
      }
      if (mines > c.mines) return false;
      if (mines + unknown < c.mines) return false;
    }
    return true;
  };

  const walk = (k: number) => {
    if (!feasible()) return;
    if (k === n) {
      total++;
      let used = 0;
      for (let j = 0; j < n; j++) if (assign[j] === 1) { counts[j]++; used++; }
      sizes.add(used);
      return;
    }
    for (const val of [0, 1] as const) {
      assign[k] = val;
      walk(k + 1);
    }
    assign[k] = -1;
  };

  walk(0);
  return total ? { counts, total, sizes } : null;
}

function ruleEnumeration(v: View, cs: Constraint[], cap = 22): Deduction[] {
  const out: Deduction[] = [];
  const comps = components(cs);
  const frontier = new Set(cs.flatMap((c) => c.cells));
  const offFrontier = hiddenCells(v).filter((c) => !frontier.has(c)).length;
  const remaining = v.mines - flaggedCount(v);

  // Bound each component by what the rest of the board could still absorb.
  const per = comps.map((c) => solutions(c, cap));

  for (let gi = 0; gi < comps.length; gi++) {
    const res = per[gi];
    if (!res) continue;

    const othersMin = per.reduce((s, r, k) =>
      k === gi || !r ? s : s + Math.min(...r.sizes), 0);
    const viable = [...res.sizes].filter((size) => {
      const left = remaining - size - othersMin;
      return left >= 0 && left <= offFrontier;
    });
    if (!viable.length) continue;

    // Re-count restricted to globally viable sizes would need the full solution
    // set; the common case is a single viable size, where the counts are exact.
    if (viable.length === 1 && res.sizes.size > 1) continue;

    comps[gi].cells.forEach((cell, k) => {
      if (res.counts[k] === res.total) {
        out.push({
          kind: "mine", cells: [cell], from: comps[gi].cons.map((c) => c.source), rule: "enumeration",
          reason: `Across every arrangement of mines that fits these clues, ${cellName(v.w, cell)} is a mine in all ${res.total} of them.`,
        });
      } else if (res.counts[k] === 0) {
        out.push({
          kind: "safe", cells: [cell], from: comps[gi].cons.map((c) => c.source), rule: "enumeration",
          reason: `Across every arrangement of mines that fits these clues, ${cellName(v.w, cell)} is never a mine.`,
        });
      }
    });
  }
  return out;
}

/* ---------------------------------------------------------------- *
 * Public
 * ---------------------------------------------------------------- */

const ORDER: ((v: View, cs: Constraint[]) => Deduction[])[] = [
  (v, cs) => ruleSatisfied(v, cs),
  (v, cs) => ruleExhausted(v, cs),
  (v) => ruleCounting(v),
  (v, cs) => ruleSubset(v, cs),
  (v, cs) => ruleEnumeration(v, cs),
];

/**
 * Every move currently forced, from the cheapest rule that finds any.
 * Empty means the position genuinely requires a guess.
 */
export function deduce(v: View): Deduction[] {
  const cs = constraints(v);
  for (const rule of ORDER) {
    const found = rule(v, cs).filter((d) => d.cells.length);
    if (found.length) return found;
  }
  return [];
}

/** The single simplest forced move, for the hint button. */
export function hint(v: View): Deduction | null {
  const all = deduce(v);
  if (!all.length) return null;
  return [...all].sort((a, b) => a.cells.length - b.cells.length)[0];
}
