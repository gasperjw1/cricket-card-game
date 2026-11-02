/**
 * Loading side of the draft-time fit (`fit.ts` has the maths): one bundle per edition (engine data,
 * ratings, field scale), one context per World Cup and coach, and the React hooks the draft and
 * lineup screens use. Everything is cached for the run, so a squad from an edition already seen
 * costs nothing to fit.
 */

import { useEffect, useState } from "react";
import type { CoachOut, EditionData, EditionOut } from "../../../wcdraft/src/engine/data.ts";
import type { PlayerRating } from "../../../wcdraft/src/ratings/model.ts";
import { loadEditionData, loadRatings } from "../lib/data.ts";
import { editionEnv, type EditionEnv } from "./final-ratings.ts";
import { classMixOf, coachFieldStep, fitPlayer, type FitContext, type PlayerFit } from "./fit.ts";
import { slotWeights } from "./slots.ts";
import { SLOTS, type PoolPlayer, type Spin } from "./types.ts";

export interface EditionBundle {
  data: EditionData;
  ratings: PlayerRating[];
  env: EditionEnv;
}

const bundles = new Map<string, Promise<EditionBundle>>();

/** One edition's engine data, ratings and field scale, built once and kept. */
export function editionBundle(editionId: string): Promise<EditionBundle> {
  let p = bundles.get(editionId);
  if (!p) {
    p = (async () => {
      const [data, ratings] = await Promise.all([loadEditionData(editionId), loadRatings(editionId)]);
      return { data, ratings, env: editionEnv(data, ratings) };
    })();
    bundles.set(editionId, p);
  }
  return p;
}

const contexts = new Map<string, Promise<FitContext>>();

const coachKey = (coach: CoachOut | null) => (coach ? `${coach.team}|${coach.coachName}|${coach.from}` : "");

export function fitContext(editions: EditionOut[], editionId: string, coach: CoachOut | null): Promise<FitContext> {
  const key = `${editionId}|${coachKey(coach)}`;
  let p = contexts.get(key);
  if (!p) {
    p = (async () => {
      const bundle = await editionBundle(editionId);
      const classMix = classMixOf(editions, editionId);
      return { editionId, here: bundle.env, classMix, slots: SLOTS.map((s) => slotWeights(editions, editionId, s.index + 1)), coachField: coachFieldStep(bundle, classMix, coach), coach };
    })();
    contexts.set(key, p);
  }
  return p;
}

async function fitOne(p: PoolPlayer, ctx: FitContext): Promise<PlayerFit | null> {
  const home = await editionBundle(p.editionId);
  const engine = home.data.players.get(`${p.team}|${p.id}`);
  const rating = home.ratings.find((r) => r.personId === p.id && r.team === p.team);
  return engine && rating ? fitPlayer(p, engine, rating, home.env, ctx) : null;
}

/** Every card in a list, keyed by player id; cards without engine data are left out. */
export async function fitPlayers(players: PoolPlayer[], ctx: FitContext): Promise<Map<string, PlayerFit>> {
  const out = new Map<string, PlayerFit>();
  for (const p of players) {
    const f = await fitOne(p, ctx);
    if (f) out.set(p.id, f);
  }
  return out;
}

function useFits(players: PoolPlayer[], editionId: string, coach: CoachOut | null, editions: EditionOut[]): Map<string, PlayerFit> | null {
  const [fits, setFits] = useState<{ key: string; map: Map<string, PlayerFit> } | null>(null);
  const key = `${players.map((p) => `${p.editionId}:${p.id}`).join(",")}|${editionId}|${coachKey(coach)}`;
  useEffect(() => {
    if (!editionId || !players.length) return;
    let live = true;
    fitContext(editions, editionId, coach)
      .then((ctx) => fitPlayers(players, ctx))
      .then((map) => { if (live) setFits({ key, map }); })
      .catch(() => { if (live) setFits({ key, map: new Map() }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return fits && fits.key === key ? fits.map : null;
}

/** The fits for the current spin, or null while they load. */
export function useSpinFit(spin: Spin | null, editionId: string, coach: CoachOut | null, editions: EditionOut[]): Map<string, PlayerFit> | null {
  return useFits(spin?.players ?? [], editionId, coach, editions);
}

/** The fits for the players already drafted, or null while they load. */
export function usePicksFit(picks: (PoolPlayer | null)[], editionId: string, coach: CoachOut | null, editions: EditionOut[]): Map<string, PlayerFit> | null {
  return useFits(picks.filter((p): p is PoolPlayer => !!p), editionId, coach, editions);
}
