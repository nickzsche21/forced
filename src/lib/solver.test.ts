import { makeBoard, emptyView, reveal, idx, isWon, rng, type Board } from "./board";
import { deduce, hint, cellName } from "./solver";
import { generate, solvableWithoutGuessing, LEVELS } from "./generate";

let pass = 0, fail = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  cond ? pass++ : fail++;
  console.log(`${cond ? "  ok  " : " FAIL "} ${label}${cond || !detail ? "" : `\n         ${detail}`}`);
};

/** Build a board from ASCII. '*' is a mine. */
function parse(rows: string[]): Board {
  const h = rows.length, w = rows[0].length;
  const mines = new Set<number>();
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === "*") mines.add(idx(w, x, y)); }));
  return makeBoard(w, h, mines);
}

console.log("\nNaming and geometry");
ok("A1 is the top-left", cellName(9, 0) === "A1", cellName(9, 0));
ok("columns run past Z", cellName(30, 26) === "AA1", cellName(30, 26));
ok("row numbers are 1-based", cellName(9, 9) === "A2", cellName(9, 9));

console.log("\nFlood fill opens a clearing, and stops at numbers");
{
  const b = parse([
    ".....",
    "...*.",
    ".....",
    "*....",
    ".....",
  ]);
  const v = emptyView(5, 5, 2);
  const opened = reveal(b, v, idx(5, 0, 0));
  ok("a zero opens more than itself", opened.length > 1, `opened ${opened.length}`);
  ok("never opens a mine", opened.every((i) => !b.mine[i]));
  ok("numbers are revealed but do not spread", v.state[idx(5, 2, 0)] === "revealed");
}

console.log("\nRule: a satisfied clue clears its neighbours");
{
  const b = parse(["...", ".*.", "..."]);
  const v = emptyView(3, 3, 1);
  v.state[idx(3, 1, 1)] = "flagged";
  v.state[idx(3, 0, 0)] = "revealed"; v.num[idx(3, 0, 0)] = 1;
  const d = deduce(v);
  ok("finds a deduction", d.length > 0);
  ok("it is a clearance", d[0]?.kind === "safe");
  ok("cites the satisfied rule", d[0]?.rule === "satisfied", d[0]?.rule);
  ok("explains itself in words", !!d[0]?.reason && d[0].reason.includes("A1"), d[0]?.reason);
}

console.log("\nRule: a clue with no room left flags the rest");
{
  const b = parse(["*..", "...", "..."]);
  const v = emptyView(3, 3, 1);
  const i = idx(3, 1, 0);
  v.state[i] = "revealed"; v.num[i] = 1;
  v.state[idx(3, 2, 0)] = "revealed"; v.num[idx(3, 2, 0)] = 0;
  v.state[idx(3, 1, 1)] = "revealed"; v.num[idx(3, 1, 1)] = 1;
  v.state[idx(3, 2, 1)] = "revealed"; v.num[idx(3, 2, 1)] = 0;
  v.state[idx(3, 0, 1)] = "revealed"; v.num[idx(3, 0, 1)] = 1;
  const d = deduce(v);
  ok("declares the mine", d.some((x) => x.kind === "mine" && x.cells.includes(idx(3, 0, 0))),
     JSON.stringify(d.map((x) => [x.kind, x.rule, x.cells])));
}

console.log("\nRule: the whole-board mine budget");
{
  const b = parse(["*.", ".."]);
  const v = emptyView(2, 2, 1);
  v.state[idx(2, 0, 0)] = "flagged";
  const d = deduce(v);
  ok("all mines flagged clears the rest", d.some((x) => x.kind === "safe" && x.rule === "counting"));
  const v2 = emptyView(2, 2, 1);
  v2.state[idx(2, 1, 0)] = "revealed"; v2.num[idx(2, 1, 0)] = 1;
  v2.state[idx(2, 0, 1)] = "revealed"; v2.num[idx(2, 0, 1)] = 1;
  v2.state[idx(2, 1, 1)] = "revealed"; v2.num[idx(2, 1, 1)] = 1;
  const d2 = deduce(v2);
  ok("one mine and one hidden square flags it", d2.some((x) => x.kind === "mine"));
}

console.log("\nHints prefer the simplest available explanation");
{
  const b = parse(["...", ".*.", "..."]);
  const v = emptyView(3, 3, 1);
  v.state[idx(3, 1, 1)] = "flagged";
  v.state[idx(3, 0, 0)] = "revealed"; v.num[idx(3, 0, 0)] = 1;
  const hi = hint(v);
  ok("returns one", !!hi);
  ok("it is human-readable", !!hi && hi.reason.length > 20 && /[.]$/.test(hi.reason), hi?.reason);
  ok("it names the clue it came from", !!hi && hi.from.length > 0);
}

console.log("\nSoundness — the claim the whole game rests on");
{
  // generate() throws if the solver ever clears a mine or flags a safe cell, so
  // driving many boards through it is a direct test of every rule at once.
  let boards = 0, deductions = 0, unsound = 0;
  const rand = rng(12345);
  for (let t = 0; t < 120; t++) {
    const w = 6 + Math.floor(rand() * 6), h = 6 + Math.floor(rand() * 6);
    const mines = Math.max(3, Math.floor(w * h * (0.10 + rand() * 0.12)));
    const g = generate({ name: "fuzz", w, h, mines }, Math.floor(rand() * 2 ** 31), 40);
    boards++;

    // Independently re-verify every deduction against ground truth.
    const v = emptyView(w, h, g.board.mines);
    reveal(g.board, v, g.first);
    for (let step = 0; step < 400; step++) {
      const ds = deduce(v);
      if (!ds.length) break;
      for (const d of ds) {
        for (const c of d.cells) {
          deductions++;
          if (d.kind === "mine" && !g.board.mine[c]) unsound++;
          if (d.kind === "safe" && g.board.mine[c]) unsound++;
          if (v.state[c] !== "hidden") continue;
          if (d.kind === "mine") v.state[c] = "flagged";
          else reveal(g.board, v, c);
        }
      }
    }
  }
  console.log(`         → ${boards} boards, ${deductions} deductions checked against ground truth`);
  ok("the solver never once asserted something false", unsound === 0, `${unsound} wrong`);
  ok("it actually did work", deductions > 500, `${deductions} deductions`);
}

console.log("\nThe guarantee, per difficulty");
for (const level of LEVELS) {
  const t0 = Date.now();
  let guaranteed = 0, totalAttempts = 0;
  const N = level.name === "expert" ? 5 : 12;
  for (let i = 0; i < N; i++) {
    const g = generate(level, 1000 + i);
    if (g.guaranteed) guaranteed++;
    totalAttempts += g.attempts;
    if (g.guaranteed) {
      // Re-solve from scratch: the flag must survive an independent replay.
      if (!solvableWithoutGuessing(g.board, g.first)) guaranteed = -999;
    }
  }
  const ms = Date.now() - t0;
  console.log(`         → ${level.name} ${level.w}×${level.h}/${level.mines}: ${guaranteed}/${N} guaranteed, ${(totalAttempts / N).toFixed(1)} attempts avg, ${(ms / N).toFixed(0)}ms per board`);
  ok(`${level.name}: every board is solvable by logic alone`, guaranteed === N, `got ${guaranteed}`);
  ok(`${level.name}: generation is fast enough to feel instant`, ms / N < 1200, `${(ms / N).toFixed(0)}ms`);
}

console.log("\nSeeds replay exactly");
{
  const a = generate(LEVELS[0], 777);
  const b = generate(LEVELS[0], 777);
  ok("same seed, same mines", JSON.stringify(a.board.mine) === JSON.stringify(b.board.mine));
  ok("same seed, same opening", a.first === b.first);
  const c = generate(LEVELS[0], 778);
  ok("different seed, different board", JSON.stringify(a.board.mine) !== JSON.stringify(c.board.mine));
}

console.log("\nOpening click is always a clearing");
{
  let clearings = 0;
  for (let i = 0; i < 25; i++) {
    const g = generate(LEVELS[1], 5000 + i);
    const v = emptyView(g.board.w, g.board.h, g.board.mines);
    const opened = reveal(g.board, v, g.first);
    if (opened.length > 1) clearings++;
  }
  ok("never opens onto a bare number or a mine", clearings === 25, `${clearings}/25`);
}

console.log("\nA solved board is recognised");
{
  const g = generate(LEVELS[0], 4242);
  const v = emptyView(g.board.w, g.board.h, g.board.mines);
  reveal(g.board, v, g.first);
  for (let s = 0; s < 500; s++) {
    const ds = deduce(v);
    if (!ds.length) break;
    for (const d of ds) for (const c of d.cells) {
      if (v.state[c] !== "hidden") continue;
      if (d.kind === "mine") v.state[c] = "flagged"; else reveal(g.board, v, c);
    }
  }
  ok("playing only forced moves wins the game", isWon(g.board, v));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
