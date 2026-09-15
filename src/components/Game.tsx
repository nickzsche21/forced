"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { emptyView, reveal, isWon, neighbours, type Board, type View } from "@/lib/board";
import { generate, LEVELS, type Difficulty } from "@/lib/generate";
import { hint, deduce, type Deduction } from "@/lib/solver";

type Status = "idle" | "playing" | "won" | "lost";

export default function Game() {
  const [level, setLevel] = useState<Difficulty>(LEVELS[1]);
  const [seed, setSeed] = useState<number | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [first, setFirst] = useState(0);
  const [guaranteed, setGuaranteed] = useState(true);
  const [view, setView] = useState<View | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [proof, setProof] = useState<Deduction | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number | null>(null);

  const newGame = useCallback((lv: Difficulty, s?: number) => {
    const g = generate(lv, s);
    setBoard(g.board);
    setFirst(g.first);
    setSeed(g.seed);
    setGuaranteed(g.guaranteed);
    setView(emptyView(lv.w, lv.h, g.board.mines));
    setStatus("idle");
    setProof(null);
    setHintsUsed(0);
    setElapsed(0);
    startedAt.current = null;
  }, []);

  useEffect(() => { newGame(level); }, [level, newGame]);

  useEffect(() => {
    if (status !== "playing") return;
    const t = setInterval(() => {
      if (startedAt.current) setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 250);
    return () => clearInterval(t);
  }, [status]);

  const flags = useMemo(
    () => (view ? view.state.filter((s) => s === "flagged").length : 0),
    [view]
  );

  function commit(next: View) {
    setView({ ...next, state: [...next.state], num: [...next.num] });
  }

  function openCell(i: number) {
    if (!board || !view || status === "won" || status === "lost") return;
    if (view.state[i] !== "hidden") return;
    setProof(null);

    const v: View = { ...view, state: [...view.state], num: [...view.num] };

    if (status === "idle") {
      // The generator guaranteed *this* opening. Honour it wherever they click.
      startedAt.current = Date.now();
      setStatus("playing");
      reveal(board, v, first);
      if (i !== first && v.state[i] === "hidden") reveal(board, v, i);
      commit(v);
      if (isWon(board, v)) finish(v, "won");
      return;
    }

    reveal(board, v, i);
    if (board.mine[i]) { finish(v, "lost"); commit(v); return; }
    commit(v);
    if (isWon(board, v)) finish(v, "won");
  }

  function finish(v: View, s: Status) {
    setStatus(s);
    if (s === "lost") {
      for (let k = 0; k < v.state.length; k++) {
        if (board?.mine[k] && v.state[k] !== "flagged") { v.state[k] = "revealed"; v.num[k] = -2; }
      }
    }
  }

  function toggleFlag(i: number) {
    if (!view || status === "won" || status === "lost" || status === "idle") return;
    if (view.state[i] === "revealed") return;
    const v: View = { ...view, state: [...view.state], num: [...view.num] };
    v.state[i] = v.state[i] === "flagged" ? "hidden" : "flagged";
    setProof(null);
    commit(v);
  }

  /** Clicking a satisfied number opens its remaining neighbours, as it always has. */
  function chord(i: number) {
    if (!board || !view || status !== "playing") return;
    if (view.state[i] !== "revealed" || view.num[i] < 1) return;
    const ns = neighbours(board.w, board.h, i);
    const flagged = ns.filter((j) => view.state[j] === "flagged").length;
    if (flagged !== view.num[i]) return;

    const v: View = { ...view, state: [...view.state], num: [...view.num] };
    let boom = false;
    for (const j of ns) {
      if (v.state[j] !== "hidden") continue;
      reveal(board, v, j);
      if (board.mine[j]) boom = true;
    }
    setProof(null);
    if (boom) { finish(v, "lost"); commit(v); return; }
    commit(v);
    if (isWon(board, v)) finish(v, "won");
  }

  function showProof() {
    if (!view || !board) return;
    if (status === "idle") { openCell(first); return; }
    if (status !== "playing") return;
    const d = hint(view);
    setProof(d);
    if (d) setHintsUsed((n) => n + 1);
  }

  function applyProof() {
    if (!proof || !view || !board) return;
    const v: View = { ...view, state: [...view.state], num: [...view.num] };
    for (const c of proof.cells) {
      if (v.state[c] !== "hidden") continue;
      if (proof.kind === "mine") v.state[c] = "flagged";
      else reveal(board, v, c);
    }
    setProof(null);
    commit(v);
    if (isWon(board, v)) finish(v, "won");
  }

  // A handle for verifying the guarantee against the live UI rather than only in
  // the test suite. The solver is deterministic, so this is enough to replay any
  // stall exactly.
  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as unknown as Record<string, unknown>).__forced = { board, view, status, first, seed, deduce, hint };
  }, [board, view, status, first, seed]);

  if (!board || !view) return <div className="mono py-20 text-center text-faint">dealing a fair board…</div>;

  const proofFrom = new Set(proof?.from ?? []);
  const proofCells = new Set(proof?.cells ?? []);
  const size = level.w > 20 ? 24 : 29;

  return (
    <div className="flex flex-col items-center">
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
        <div className="inline-flex rounded-lg border border-line bg-panel p-0.5">
          {LEVELS.map((lv) => (
            <button key={lv.name} onClick={() => setLevel(lv)}
              className={`mono rounded-[6px] px-3 py-1.5 text-[12px] transition-colors ${
                level.name === lv.name ? "bg-raise text-ink" : "text-faint hover:text-dim"}`}>
              {lv.name}
            </button>
          ))}
        </div>
        <button onClick={() => newGame(level)}
          className="mono rounded-lg border border-line bg-panel px-3 py-1.5 text-[12px] text-dim transition-colors hover:border-proof/45 hover:text-proof">
          new board
        </button>
      </div>

      {/* Status bar */}
      <div className="mb-3 flex w-full max-w-full items-center justify-between gap-4 rounded-lg border border-line bg-panel px-4 py-2.5"
        style={{ width: level.w * (size + 3) }}>
        <span className="mono text-[13px] text-dim">
          <span className="text-mine">{board.mines - flags}</span> left
        </span>
        <span className="mono text-[13px]">
          {status === "won" && <span className="text-safe">solved · no guesses needed</span>}
          {status === "lost" && <span className="text-mine">that one was avoidable</span>}
          {(status === "playing" || status === "idle") && (
            <span className="text-faint">{guaranteed ? "logic-solvable" : "⚠ fell back to a guessable board"}</span>
          )}
        </span>
        <span className="mono text-[13px] text-dim">{elapsed}s</span>
      </div>

      {/* Board */}
      <div
        className="grid touch-manipulation"
        style={{ gridTemplateColumns: `repeat(${level.w}, ${size}px)`, gap: 3 }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {view.state.map((st, i) => {
          const n = view.num[i];
          const isMine = n === -2;
          const cls = [
            "cell",
            st === "revealed" ? "cell-open" : "cell-hidden",
            proofFrom.has(i) ? "proof-from" : "",
            proofCells.has(i) ? (proof!.kind === "safe" ? "proof-safe" : "proof-mine") : "",
          ].join(" ");
          return (
            <div
              key={i}
              className={cls}
              style={{ width: size, height: size, fontSize: size * 0.5, cursor: status === "won" || status === "lost" ? "default" : "pointer" }}
              onClick={() => (st === "revealed" ? chord(i) : openCell(i))}
              onContextMenu={(e) => { e.preventDefault(); toggleFlag(i); }}
              role="button"
              aria-label={st === "revealed" ? (isMine ? "mine" : `${n}`) : st}
            >
              {st === "flagged" && <span className="text-mine" style={{ fontSize: size * 0.46 }}>⚑</span>}
              {st === "revealed" && isMine && <span className="text-mine" style={{ fontSize: size * 0.48 }}>✳</span>}
              {st === "revealed" && n > 0 && <span className={`n${n}`}>{n}</span>}
            </div>
          );
        })}
      </div>

      {/* The proof */}
      <div className="mt-4 w-full" style={{ maxWidth: Math.max(level.w * (size + 3), 420) }}>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={showProof} disabled={status === "won" || status === "lost"}
            className="mono rounded-lg border border-proof/45 bg-proof/10 px-4 py-2 text-[12.5px] text-proof transition-colors hover:bg-proof/15 disabled:cursor-not-allowed disabled:opacity-35">
            {status === "idle" ? "open the first square" : "show me a forced move"}
          </button>
          {proof && (
            <button onClick={applyProof}
              className="mono rounded-lg border border-line bg-panel px-4 py-2 text-[12.5px] text-dim hover:text-ink">
              play it
            </button>
          )}
          {hintsUsed > 0 && <span className="mono text-[11.5px] text-faint">{hintsUsed} shown</span>}
          <span className="mono ml-auto text-[11px] text-faint">seed {seed}</span>
        </div>

        {proof && (
          <div className="sticky bottom-3 z-10 mt-3 rounded-lg border px-4 py-3 backdrop-blur-md"
            style={{
              borderColor: proof.kind === "safe" ? "color-mix(in srgb, var(--color-safe) 40%, transparent)" : "color-mix(in srgb, var(--color-mine) 40%, transparent)",
              background: proof.kind === "safe"
                ? "color-mix(in srgb, var(--color-safe) 9%, rgba(10,11,13,.93))"
                : "color-mix(in srgb, var(--color-mine) 9%, rgba(10,11,13,.93))",
            }}>
            <div className="mono mb-1.5 text-[10px] uppercase tracking-[0.14em]"
              style={{ color: proof.kind === "safe" ? "var(--color-safe)" : "var(--color-mine)" }}>
              {proof.kind === "safe" ? "these are clear" : "these are mines"} · {proof.rule}
            </div>
            <p className="text-[14px] leading-[1.6] text-ink">{proof.reason}</p>
          </div>
        )}

        {!proof && status === "playing" && (
          <p className="mono mt-3 text-[11.5px] leading-relaxed text-faint">
            right-click to flag · click a satisfied number to clear around it · every board here can
            be finished without a single guess
          </p>
        )}

        {status === "lost" && (
          <div className="mt-3 rounded-lg border border-line bg-panel px-4 py-3">
            <p className="text-[14px] leading-[1.6] text-dim">
              There was a forced move available. That is the point of this version — the board was
              proven solvable by logic before you saw it, so a loss is always something that could
              have been worked out.
            </p>
            <button onClick={() => newGame(level)}
              className="mono mt-3 rounded-lg border border-line bg-raise px-3 py-2 text-[12px] text-dim hover:text-ink">
              deal another
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
