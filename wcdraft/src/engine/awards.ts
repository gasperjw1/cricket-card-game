/**
 * Player of the match (added 2026-10-30 for the match summary). A points rule, not a model: runs
 * scaled by strike rate, wickets with an economy adjustment, a little for catches and run-outs,
 * and a tilt to the winning side. Pure over a MatchResult so the client and the tournament agree.
 */

import type { MatchResult } from "./types.js";

export interface Award {
  id: string;
  name: string;
  team: string;
  points: number;
  /** "53 (33) & 2/27" style line. */
  summary: string;
}

export function playerOfTheMatch(m: MatchResult): Award | null {
  if (!m.winner) return null;
  const tally = new Map<string, Award & { parts: string[] }>();
  // By team and person: a drafted player can face his own real side, and those are two different lines.
  const add = (id: string, name: string, team: string, points: number, part: string | null) => {
    const key = `${team}|${id}`;
    const a = tally.get(key) ?? tally.set(key, { id, name, team, points: 0, summary: "", parts: [] }).get(key)!;
    a.points += points;
    if (part) a.parts.push(part);
  };
  for (const inn of m.innings) {
    const bowlingTeam = inn.index === 1 ? m.innings[1].team : m.innings[0].team;
    for (const b of inn.batting) {
      if (b.balls === 0 && !b.out) continue;
      const sr = b.balls ? (100 * b.runs) / b.balls : 0;
      const tempo = Math.max(-0.4, Math.min(0.5, (sr - 110) / 200));
      add(b.id, b.name, inn.team, b.runs * (1 + tempo), `${b.runs}${b.out ? "" : "*"} (${b.balls})`);
      const f = b.dismissal?.fielder;
      if (f) add(f.id, f.name, bowlingTeam, b.dismissal!.kind === "run out" ? 4 : 2.5, null);
    }
    for (const w of inn.bowling) {
      const overs = w.balls / 6;
      const econ = overs ? w.runs / overs : 0;
      add(w.id, w.name, bowlingTeam, 22 * w.wickets + Math.max(-10, (7.8 - econ) * overs * 0.9), `${w.wickets}/${w.runs}`);
    }
  }
  let best: (Award & { parts: string[] }) | null = null;
  for (const a of tally.values()) {
    const points = a.points * (m.winner && a.team === m.winner ? 1.15 : 1);
    if (!best || points > best.points) best = { ...a, points };
  }
  return best ? { id: best.id, name: best.name, team: best.team, points: +best.points.toFixed(1), summary: best.parts.join(" & ") } : null;
}
