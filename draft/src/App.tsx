import { useEffect, useMemo, useReducer, useState } from "react";
import { Rng } from "../../wcdraft/src/engine/rng.ts";
import type { CoachOut, SquadOut } from "../../wcdraft/src/engine/data.ts";
import { loadPool, loadShared, loadSquads, type SharedData } from "./lib/data.ts";
import { BUDGET, coachPool, drawCoachPanel, drawSquad, eligible, spinPlayers, squadUniverse, type SquadRef } from "./game/rules.ts";
import { runTournament } from "./game/simulate.ts";
import type { PoolPlayer, RunState, Spin } from "./game/types.ts";
import { HomeScreen } from "./screens/HomeScreen.tsx";
import { IdentityScreen } from "./screens/IdentityScreen.tsx";
import { CoachScreen } from "./screens/CoachScreen.tsx";
import { DraftScreen } from "./screens/DraftScreen.tsx";
import { LineupScreen } from "./screens/LineupScreen.tsx";
import { ResultScreen } from "./screens/ResultScreen.tsx";

type Action =
  | { type: "start"; seed: string }
  | { type: "identity"; team: string; editionId: string; standIn: boolean; reroll: boolean }
  | { type: "confirmIdentity" }
  | { type: "coachPanel"; panel: CoachOut[]; reroll: boolean }
  | { type: "pickCoach"; coach: CoachOut }
  | { type: "spin"; spin: Spin; reroll: boolean }
  | { type: "place"; player: PoolPlayer; slot: number }
  | { type: "swap"; a: number; b: number }
  | { type: "captain"; id: string | null }
  | { type: "toLineup" }
  | { type: "backToDraft" }
  | { type: "simulating" }
  | { type: "result"; result: RunState["result"] }
  | { type: "error"; message: string }
  | { type: "home" };

const initial = (seed = ""): RunState => ({
  seed, step: "home", identity: null, identityRerolls: BUDGET.identityRerolls, coachPanel: [], coach: null, coachRerolls: BUDGET.coachRerolls,
  spin: null, spinNumber: 0, spinRerolls: BUDGET.spinRerolls, picks: Array.from({ length: 11 }, () => null), captainId: null, result: null, error: null,
});

function reduce(s: RunState, a: Action): RunState {
  switch (a.type) {
    case "start": return { ...initial(a.seed), step: "identity" };
    case "identity": return { ...s, identity: { team: a.team, editionId: a.editionId, standIn: a.standIn }, identityRerolls: a.reroll ? s.identityRerolls - 1 : s.identityRerolls };
    case "confirmIdentity": return { ...s, step: "coach" };
    case "coachPanel": return { ...s, coachPanel: a.panel, coachRerolls: a.reroll ? s.coachRerolls - 1 : s.coachRerolls };
    case "pickCoach": return { ...s, coach: a.coach, step: "draft", spinNumber: 1 };
    case "spin": return { ...s, spin: a.spin, spinRerolls: a.reroll ? s.spinRerolls - 1 : s.spinRerolls };
    case "place": {
      const picks = [...s.picks];
      picks[a.slot] = a.player;
      const done = picks.every(Boolean);
      return { ...s, picks, spin: null, spinNumber: s.spinNumber + 1, step: done ? "lineup" : "draft" };
    }
    case "swap": {
      const picks = [...s.picks];
      [picks[a.a], picks[a.b]] = [picks[a.b] ?? null, picks[a.a] ?? null];
      return { ...s, picks };
    }
    case "captain": return { ...s, captainId: a.id };
    case "toLineup": return { ...s, step: "lineup" };
    case "backToDraft": return { ...s, step: "draft" };
    case "simulating": return { ...s, step: "simulating", error: null };
    case "result": return { ...s, step: "result", result: a.result };
    case "error": return { ...s, step: s.step === "simulating" ? "lineup" : s.step, error: a.message };
    case "home": return initial();
  }
}

export function App() {
  const [state, dispatch] = useReducer(reduce, undefined, () => initial());
  const [shared, setShared] = useState<SharedData | null>(null);
  const [universe, setUniverse] = useState<SquadRef[] | null>(null);
  const [squadsByEdition, setSquadsByEdition] = useState<Map<string, SquadOut[]> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadShared()
      .then(async (s) => {
        setShared(s);
        const entries = await Promise.all(s.editionIds.map(async (id) => [id, await loadSquads(id)] as const));
        const map = new Map(entries);
        setSquadsByEdition(map);
        setUniverse(squadUniverse(map, s.blankSquads));
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  // Nothing is saved yet, so warn before a refresh or a closed tab loses the run.
  useEffect(() => {
    if (state.step === "home") return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.step]);

  // Every new screen, and every new squad to pick from, starts at the top: on a phone the last tap
  // is often far down a long page.
  useEffect(() => { window.scrollTo(0, 0); }, [state.step, state.spin]);

  // One deterministic stream per action, so a seed replays a run exactly.
  const rng = useMemo(() => (state.seed ? new Rng(state.seed) : null), [state.seed]);
  const stream = (label: string) => new Rng(`${state.seed}:${label}`);

  const spinIdentity = (reroll: boolean) => {
    if (!universe) return;
    const pick = drawSquad(universe, stream(`identity:${reroll ? "reroll" : "first"}`));
    dispatch({ type: "identity", team: pick.team, editionId: pick.editionId, standIn: pick.standIn, reroll });
  };
  const spinCoaches = (reroll: boolean) => {
    if (!shared) return;
    dispatch({ type: "coachPanel", panel: drawCoachPanel(coachPool(shared.coaches), stream(`coaches:${reroll ? "reroll" : "first"}`)), reroll });
  };
  const spinSquad = async (reroll: boolean) => {
    if (!universe) return;
    const taken = new Set(state.picks.filter(Boolean).map((p) => p!.id));
    const label = `spin:${state.spinNumber}:${reroll ? `r${state.spinRerolls}` : "first"}`;
    const r = stream(label);
    // Draw until the spun squad still has someone undrafted (always true in practice).
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const squad = drawSquad(universe, r);
      const pool = await loadPool(squad.editionId);
      const players = spinPlayers(pool, squad.team, taken);
      // A spin must offer someone the side can still take (bowlers or a keeper once the slots are tight).
      if (players.some((p) => eligible(p, state.picks))) { dispatch({ type: "spin", spin: { team: squad.team, editionId: squad.editionId, players }, reroll }); return; }
    }
    dispatch({ type: "error", message: "No squad with undrafted players found; try a reroll." });
  };

  useEffect(() => {
    if (state.step === "identity" && !state.identity) spinIdentity(false);
    if (state.step === "coach" && !state.coachPanel.length) spinCoaches(false);
    if (state.step === "draft" && !state.spin) void spinSquad(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, state.identity, state.coachPanel.length, state.spin, universe, shared]);

  const simulate = async () => {
    if (!state.identity) return;
    dispatch({ type: "simulating" });
    try {
      const result = await runTournament({ seed: state.seed, identity: state.identity, picks: state.picks.filter(Boolean) as PoolPlayer[], coach: state.coach, captainId: state.captainId });
      dispatch({ type: "result", result });
    } catch (e) {
      dispatch({ type: "error", message: (e as Error).message });
    }
  };

  if (loadError) return <main className="shell"><p className="error">Could not load the data files: {loadError}. Run <code>npm run sync:data --workspace draft</code> after building the wcdraft outputs.</p></main>;

  return (
    <main className={`shell ${state.step === "draft" ? "shell-draft" : ""}`}>
      <header className="top">
        <h1 onClick={() => { if (state.step === "home" || window.confirm("Leave this run and start again? It can't be recovered.")) dispatch({ type: "home" }); }}>World Cup Draft</h1>
        <span className="seed">{state.seed ? `seed ${state.seed} · ` : ""}<a href="/" className="back-link">Swipe Sixer</a></span>
      </header>
      {state.error && <p className="error">{state.error}</p>}
      {state.step === "home" && <HomeScreen ready={!!universe} onStart={(seed) => dispatch({ type: "start", seed })} />}
      {state.step === "identity" && shared && (
        <IdentityScreen identity={state.identity} editions={shared.editions} venues={shared.venues} squads={state.identity ? squadsByEdition?.get(state.identity.editionId) ?? [] : []} rerolls={state.identityRerolls} onReroll={() => spinIdentity(true)} onConfirm={() => dispatch({ type: "confirmIdentity" })} />
      )}
      {state.step === "coach" && shared && (
        <CoachScreen panel={state.coachPanel} rerolls={state.coachRerolls} identity={state.identity} editions={shared.editions} venues={shared.venues} squads={state.identity ? squadsByEdition?.get(state.identity.editionId) ?? [] : []} onReroll={() => spinCoaches(true)} onPick={(coach) => dispatch({ type: "pickCoach", coach })} />
      )}
      {state.step === "draft" && shared && (
        <DraftScreen state={state} editions={shared.editions} venues={shared.venues} squads={state.identity ? squadsByEdition?.get(state.identity.editionId) ?? [] : []} onPlace={(player, slot) => dispatch({ type: "place", player, slot })} onReroll={() => void spinSquad(true)} onLineup={() => dispatch({ type: "toLineup" })} />
      )}
      {state.step === "lineup" && shared && (
        <LineupScreen state={state} captains={shared.captains} editions={shared.editions} onCaptain={(id) => dispatch({ type: "captain", id })} onBack={() => dispatch({ type: "backToDraft" })} onSimulate={() => void simulate()} />
      )}
      {state.step === "simulating" && <section className="card"><h2>Simulating the {state.identity?.editionId} World Cup…</h2><p>Every match of the tournament, ball by ball.</p></section>}
      {state.step === "result" && state.result && shared && <ResultScreen state={state} result={state.result} editions={shared.editions} venues={shared.venues} onAgain={() => dispatch({ type: "home" })} />}
      {rng && state.step !== "home" && state.step !== "result" && <footer className="foot">Spins and simulation are deterministic for this seed.</footer>}
    </main>
  );
}
