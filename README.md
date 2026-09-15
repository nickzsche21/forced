# FORCED

**Minesweeper that never makes you guess — and shows you the proof.**

Every board is played to completion by a solver *before you ever see it*. If it needs a coin flip,
it is thrown away. When you are stuck, it shows you the exact clue that forces the next move.

No ads. No account. No subscription. Works offline.

**Live: https://forced-two.vercel.app**

---

## Why this exists

Microsoft Solitaire charges **$1.99/month** to remove ads from a game that shipped free with
Windows for decades — and its own support forum carries 2026 threads from people who *are paying*
and still get ads, reporting they "keep getting longer and longer". In 2024, Hacker News put
**"Microsoft's official Minesweeper app has ads, pay-to-win, and is hundreds of MB"** on the front
page for 389 points.

The trigger was a comment in HN's "What are you working on?" thread on 14 September 2026:

> "I got sick of stuff like Solitaire and Hearts requiring subscriptions or coming with ads in
> 2026 — that stuff came with your computer in my youth and got enshittified. I hate seeing my
> family playing all this pesterware." — *furyofantares*

And, in the same thread:

> "more than 50% [of Show HN] are dev tools and AI. Some kind of golden shovels situation. I wish
> there were more games, personal apps... more fun stuff" — *brachkow*

Minesweeper is a proven genre there — a dozen variants have cleared 250+ points — but the plain
ones are taken, including a no-guess version from 2020. So the guarantee alone was not enough.
The addition here is that the solver **explains itself**.

## The guarantee is proven, not promised

Mines are placed, then the board is played out by the solver using nothing but forced moves. If it
stalls anywhere, that layout is discarded and another is dealt. The *same* solver drives the hint
button, so the thing that guarantees the board is the thing that explains it.

| level | board | attempts to find a fair one | time |
| --- | --- | --- | --- |
| beginner | 9×9 / 10 | 1.3 avg | <1ms |
| intermediate | 16×16 / 40 | 2.3 avg | 1ms |
| expert | 30×16 / 99 | 7.8 avg | 5ms |

## The rules, cheapest first

A hint is the simplest true explanation available, not whatever a search found first.

| rule | what it sees |
| --- | --- |
| `satisfied` | A number already touching all its mines — everything else it sees is clear. |
| `exhausted` | A number with exactly as many hidden neighbours as mines left. All are mines. |
| `counting` | The whole-board mine budget. Settles most endgames by itself. |
| `subset` | One clue's cells sit inside another's. Subtract them. This is where 1-2-1 lives. |
| `enumeration` | Every mine arrangement fitting the clues is enumerated; what holds in all of them is forced. |

Components are separated before enumeration and bounded by what the rest of the board could still
absorb, which keeps expert endgames instant.

## Soundness

The claim is worthless if the solver is ever wrong, so the test suite checks every deduction
against ground truth: **6,246 deductions across 120 random boards, none of them wrong.** Generation
*throws* if the solver ever clears a mine or flags a safe square, rather than quietly shipping a
broken promise.

A full 16×16/40 board was also played to a win in the live UI using nothing but the hint button.

```bash
npm install
npm test      # 29 assertions, including the soundness fuzz
npm run dev
```

Seeds are shown in the UI and replay exactly — `generate(level, seed)` is deterministic.

MIT.
