/**
 * Loading side of the souvenir issue (`souvenir.ts` has the sums): every player's expectation in
 * the World Cup being played, your eleven through the same `finalRatings` the Player ratings tab
 * uses, the CPU sides through `computeFinal` on the identity edition at each man's usual position.
 */

import { useEffect, useState } from "react";
import type { EditionOut } from "../../../wcdraft/src/engine/data.ts";
import { loadEditionData, loadPool, loadRatings } from "../lib/data.ts";
import { computeFinal, editionEnv } from "./final-ratings.ts";
import { classMixOf, usualPosition } from "./fit.ts";
import { finalRatings, type SimulateInput } from "./simulate.ts";
import { slotWeights } from "./slots.ts";
import type { Expectation } from "./souvenir.ts";
import { totalsKey } from "./stats.ts";

export async function expectationsFor(input: SimulateInput, editions: EditionOut[]): Promise<Map<string, Expectation>> {
  const here = input.identity.editionId;
  const out = new Map<string, Expectation>();
  const [data, ratings, pool, mine] = await Promise.all([loadEditionData(here), loadRatings(here), loadPool(here), finalRatings(input, editions)]);
  const env = editionEnv(data, ratings);
  const classMix = classMixOf(editions, here);
  for (const f of mine) {
    const p = f.player;
    out.set(totalsKey(input.identity.team, p.id), {
      name: p.name, team: input.identity.team, cardBat: p.batShown ? p.bat : null, cardBowl: p.bowlShown && f.bowling ? p.bowl : null,
      bat: p.batShown ? f.batting.here : null, bowl: p.bowlShown && f.bowling ? f.bowling.here : null,
    });
  }
  for (const p of pool) {
    if (p.team === input.identity.team) continue;
    const engine = data.players.get(`${p.team}|${p.id}`);
    const rating = ratings.find((r) => r.team === p.team && r.personId === p.id);
    if (!engine || !rating) continue;
    const position = usualPosition(p);
    const f = computeFinal({ player: p, rating, engine, home: env, here: env, position, slot: slotWeights(editions, here, position), classMix, keeps: false });
    out.set(totalsKey(p.team, p.id), { name: p.name, team: p.team, cardBat: p.batShown ? p.bat : null, cardBowl: p.bowlShown ? p.bowl : null, bat: p.batShown ? f.batting.here : null, bowl: p.bowlShown && f.bowling ? f.bowling.here : null });
  }
  return out;
}

/** The expectations for a run, or null while they load. */
export function useExpectations(input: SimulateInput, editions: EditionOut[]): Map<string, Expectation> | null {
  const [value, setValue] = useState<Map<string, Expectation> | null>(null);
  useEffect(() => {
    let live = true;
    expectationsFor(input, editions).then((m) => { if (live) setValue(m); }).catch(() => { if (live) setValue(new Map()); });
    return () => { live = false; };
  }, [input, editions]);
  return value;
}
