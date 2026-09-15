import Game from "@/components/Game";

const RULES = [
  ["satisfied", "A number already touching all its mines — everything else it can see is clear."],
  ["exhausted", "A number with exactly as many hidden neighbours as mines left. All of them are mines."],
  ["counting", "The whole-board mine budget. Settles most endgames by itself."],
  ["subset", "One clue's cells sit entirely inside another's. Subtract them. This is where 1-2-1 lives."],
  ["enumeration", "Every arrangement of mines that fits the clues is enumerated; whatever holds in all of them is forced."],
];

export default function Page() {
  return (
    <main className="px-5 pb-24">
      {/* Deliberately short. The proof panel is the point of this page and it
          lives under the board — every pixel spent up here pushes it off screen. */}
      <header className="mx-auto max-w-5xl pt-9 pb-6 text-center">
        <h1 className="text-[clamp(34px,6vw,54px)] font-semibold leading-[0.92] tracking-[-0.05em]">
          FORCED
        </h1>
        <p className="mx-auto mt-2.5 text-[15px] leading-snug text-dim">
          Minesweeper that never makes you guess — and shows you the proof.
        </p>
      </header>

      <div className="mx-auto w-fit max-w-full overflow-x-auto pb-6">
        <Game />
      </div>

      <p className="mx-auto mt-10 max-w-[60ch] px-1 text-center text-[14.5px] leading-[1.7] text-dim">
        Every board is played to completion by a solver before you ever see it. If it needs a coin
        flip, it is thrown away. When you are stuck, it shows you the exact clue that forces the
        next move.
      </p>
      <div className="mono mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[11px] uppercase tracking-[0.14em] text-faint">
        <span>no ads</span><span className="text-line">/</span>
        <span>no account</span><span className="text-line">/</span>
        <span>no subscription</span><span className="text-line">/</span>
        <span>works offline</span>
      </div>

      {/* Why */}
      <section className="mx-auto mt-20 max-w-3xl border-t border-line pt-14">
        <div className="mono mb-3 text-[11px] uppercase tracking-[0.18em] text-faint">why this exists</div>
        <h2 className="text-[28px] font-medium leading-[1.15] tracking-[-0.025em]">
          The games that came free with your computer now want $1.99 a month.
        </h2>
        <div className="mt-6 space-y-4 text-[15px] leading-[1.7] text-dim">
          <p>
            Microsoft Solitaire charges <span className="text-ink">$1.99/month</span> to remove ads
            from a game that shipped free with Windows for decades. Its own support forum is full of
            2026 threads from people who <em className="not-italic text-ink">are paying</em> and still
            get ads, reporting that they &ldquo;keep getting longer and longer&rdquo;. In 2024 the
            front page of Hacker News carried{" "}
            <span className="text-ink">
              &ldquo;Microsoft&rsquo;s official Minesweeper app has ads, pay-to-win, and is hundreds
              of MB&rdquo;
            </span>{" "}
            — 389 points of agreement.
          </p>
          <blockquote className="border-l-2 border-line pl-5 text-[14.5px] italic leading-[1.65]">
            &ldquo;I got sick of stuff like Solitaire and Hearts requiring subscriptions or coming
            with ads in 2026 — that stuff came with your computer in my youth and got enshittified.
            I hate seeing my family playing all this pesterware.&rdquo;
            <span className="mono block pt-2 text-[11.5px] not-italic text-faint">
              — Hacker News, 14 September 2026
            </span>
          </blockquote>
          <p>
            This is that, minus all of it. One page, about 40KB, no network calls after it loads.
            The only thing added is the part Minesweeper always deserved: a guarantee that the board
            is winnable by thinking.
          </p>
        </div>
      </section>

      {/* How the guarantee works */}
      <section className="mx-auto mt-16 max-w-3xl border-t border-line pt-14">
        <div className="mono mb-3 text-[11px] uppercase tracking-[0.18em] text-faint">the guarantee</div>
        <h2 className="text-[28px] font-medium leading-[1.15] tracking-[-0.025em]">
          Proven, not promised.
        </h2>
        <p className="mt-5 text-[15px] leading-[1.7] text-dim">
          Mines are placed, then the board is played out by the solver using nothing but forced
          moves. If it stalls anywhere, the layout is discarded and another is dealt. An expert
          board takes about eight tries and five milliseconds. The same solver runs the hint button,
          so the thing that guarantees the board is the thing that explains it.
        </p>

        <div className="mt-8 overflow-hidden rounded-xl border border-line">
          {RULES.map(([name, what], i) => (
            <div key={name} className={`flex flex-col gap-1 px-5 py-4 sm:flex-row sm:gap-5 ${i ? "border-t border-line" : ""}`}>
              <span className="mono shrink-0 text-[12px] text-proof sm:w-[110px]">{name}</span>
              <span className="text-[13.5px] leading-[1.6] text-dim">{what}</span>
            </div>
          ))}
        </div>

        <p className="mt-6 text-[13.5px] leading-[1.65] text-faint">
          Rules are tried cheapest first, so a hint is the simplest true explanation available rather
          than whatever a search found first. The solver&rsquo;s soundness is checked against ground
          truth on every board it generates — 6,246 deductions across 120 random boards in the test
          suite, none of them wrong. If it ever cleared a mine or flagged a safe square, generation
          would throw rather than quietly ship a broken promise.
        </p>
      </section>

      <footer className="mx-auto mt-16 max-w-3xl border-t border-line pt-8">
        <div className="mono flex flex-col gap-2 text-[11.5px] text-faint sm:flex-row sm:justify-between">
          <span>FORCED · MIT · no ads, ever</span>
          <span>every board provably winnable without a guess</span>
        </div>
      </footer>
    </main>
  );
}
