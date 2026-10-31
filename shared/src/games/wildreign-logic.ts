/**
 * Wild Reign — pure game-logic utilities, no Express/Prisma/React dependency.
 *
 * Single canonical copy, imported by server (authoritative validation),
 * cottage (2-player legacy table), and play (N-player table) — see
 * shared/package.json's "./games/wildreign" export.
 */

export type Card = { suit: string; rank: string; faceUp: boolean; id: number };

export const FC_SUITS = ["♠", "♥", "♦", "♣", "★"];
export const FC_RANKS = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const FC_RANK_VAL: Record<string, number> = {
  "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, J: 11, Q: 12, K: 13,
};

export function wildRank(round: number): string {
  return FC_RANKS[round - 1]!;
}

export function isWild(c: Card, round: number): boolean {
  return c.rank === "JK" || c.rank === wildRank(round);
}

export function cardPts(c: Card, round: number): number {
  if (c.rank === "JK") return 50;
  if (c.rank === wildRank(round)) return 20;
  return FC_RANK_VAL[c.rank] || 0;
}

/** Set (3+ same rank) or run (3+ consecutive same suit); wilds substitute freely. */
export function isValidBucket(cards: Card[], round: number): boolean {
  if (cards.length < 3) return false;
  const w = cards.filter(c => isWild(c, round));
  const n = cards.filter(c => !isWild(c, round));
  if (n.length === 0) return cards.length >= 3;
  if (n.every(c => c.rank === n[0]!.rank)) return true;
  if (!n.every(c => c.suit === n[0]!.suit)) return false;
  const ri = n.map(c => FC_RANKS.indexOf(c.rank)).sort((a, b) => a - b);
  const span = ri[ri.length - 1]! - ri[0]! + 1;
  return span <= cards.length && new Set(ri).size === ri.length;
}

/** 5 suits × 11 ranks × 2 copies + 5 jokers = 115 cards, Fisher-Yates shuffled. */
export function makeFCDeck(): Card[] {
  const d: Card[] = [];
  let id = 0;
  for (let x = 0; x < 2; x++)
    for (const s of FC_SUITS)
      for (const r of FC_RANKS)
        d.push({ suit: s, rank: r, faceUp: true, id: id++ });
  for (let i = 0; i < 5; i++) d.push({ suit: "☆", rank: "JK", faceUp: true, id: id++ });
  for (let i = d.length - 1; i > 0; i--) {
    const j = 0 | (Math.random() * (i + 1));
    [d[i], d[j]] = [d[j]!, d[i]!];
  }
  return d;
}

/**
 * solveMinDeadwood — finds the non-overlapping subset of `allMelds` that
 * minimises the sum of scoreFn(card) over unmelded cards.
 */
export function solveMinDeadwood(
  allMelds: number[][],
  hand: Card[],
  scoreFn: (c: Card, i: number) => number,
  cap = 10000,
): number[][] {
  let bestMelds: number[][] = [];
  let bestDw = Infinity;

  function dw(used: Set<number>): number {
    let d = 0;
    hand.forEach((c, i) => { if (!used.has(i)) d += scoreFn(c, i); });
    return d;
  }

  const ordered = [...allMelds].sort((a, b) => b.length - a.length);

  const NODE_BUDGET = 50000;
  let nodes = 0;
  let bailed = false;

  function solve(idx: number, used: Set<number>, cur: number[][]) {
    if (++nodes > NODE_BUDGET) { bailed = true; return; }
    const d = dw(used);
    if (d < bestDw) { bestDw = d; bestMelds = cur.map(m => [...m]); }
    if (d === 0 || idx >= ordered.length) return;
    for (let mi = idx; mi < ordered.length; mi++) {
      if (bailed) return;
      const m = ordered[mi]!;
      if (m.some(i => used.has(i))) continue;
      m.forEach(i => used.add(i));
      cur.push(m);
      solve(mi + 1, used, cur);
      cur.pop();
      m.forEach(i => used.delete(i));
      if (bestDw === 0) return;
    }
  }

  if (allMelds.length <= cap) {
    solve(0, new Set(), []);
  }

  if (bailed || allMelds.length > cap) {
    function greedy(setsFirst: boolean): number[][] {
      const used = new Set<number>();
      const melds: number[][] = [];

      function doSets() {
        const byR: Record<string, number[]> = {};
        hand.forEach((c, i) => {
          if (used.has(i)) return;
          (byR[c.rank] ??= []).push(i);
        });
        for (const r in byR) {
          const idxs = byR[r]!;
          if (idxs.length >= 3) {
            melds.push([...idxs]);
            idxs.forEach(i => used.add(i));
          }
        }
      }

      function doRuns() {
        const byS: Record<string, { i: number; ri: number }[]> = {};
        hand.forEach((c, i) => {
          if (used.has(i)) return;
          (byS[c.suit] ??= []).push({ i, ri: FC_RANKS.indexOf(c.rank) });
        });
        for (const s in byS) {
          const sorted = byS[s]!.sort((a, b) => a.ri - b.ri);
          let run = [sorted[0]!];
          for (let j = 1; j < sorted.length; j++) {
            const next = sorted[j]!;
            if (next.ri === run[run.length - 1]!.ri + 1) {
              run.push(next);
            } else {
              if (run.length >= 3) { melds.push(run.map(x => x.i)); run.forEach(x => used.add(x.i)); }
              run = [next];
            }
          }
          if (run.length >= 3) { melds.push(run.map(x => x.i)); run.forEach(x => used.add(x.i)); }
        }
      }

      if (setsFirst) { doSets(); doRuns(); } else { doRuns(); doSets(); }
      return melds;
    }

    const m1 = greedy(true);
    const m2 = greedy(false);
    const s1 = new Set<number>(); m1.forEach(m => m.forEach(i => s1.add(i)));
    const s2 = new Set<number>(); m2.forEach(m => m.forEach(i => s2.add(i)));
    const greedyBest = dw(s1) <= dw(s2) ? m1 : m2;
    const sg = new Set<number>(); greedyBest.forEach(m => m.forEach(i => sg.add(i)));
    if (dw(sg) < bestDw) { bestMelds = greedyBest; bestDw = dw(sg); }
  }

  return bestMelds;
}

/**
 * Enumerate all valid melds over a hand (wild/non-wild subset combinations)
 * and return the deadwood-minimising subset via solveMinDeadwood.
 */
export function autoMeldHand(hand: Card[], round: number): { melds: number[][]; melded: Set<number> } {
  const wIdx = hand.map((c, i) => (isWild(c, round) ? i : -1)).filter(i => i >= 0);
  const nIdx = hand.map((c, i) => (!isWild(c, round) ? i : -1)).filter(i => i >= 0);
  const allMelds: number[][] = [];
  const seen = new Set<string>();
  function add(m: number[]) {
    if (m.length < 3 || m.length > hand.length) return;
    const k = [...m].sort((a, b) => a - b).join(",");
    if (seen.has(k) || !isValidBucket(m.map(i => hand[i]!), round)) return;
    seen.add(k);
    allMelds.push(m);
  }
  const nPow = 1 << nIdx.length, wPow = 1 << wIdx.length;
  for (let nm = 1; nm < nPow; nm++) {
    const ns = nIdx.filter((_, i) => (nm >> i) & 1);
    for (let wm = 0; wm < wPow; wm++) {
      const ws = wIdx.filter((_, i) => (wm >> i) & 1);
      add([...ns, ...ws]);
    }
  }
  if (wIdx.length >= 3) add([...wIdx]);
  const melds = solveMinDeadwood(allMelds, hand, c => cardPts(c, round));
  const melded = new Set<number>();
  melds.forEach(m => m.forEach(i => melded.add(i)));
  return { melds, melded };
}

/** Best-possible deadwood for a hand — the number the "Go Out" gate checks against 0. */
export function bestDw(cards: Card[], round: number): number {
  if (cards.length === 0) return 0;
  const { melded } = autoMeldHand(cards, round);
  let dw = 0;
  cards.forEach((c, i) => { if (!melded.has(i)) dw += cardPts(c, round); });
  return dw;
}
