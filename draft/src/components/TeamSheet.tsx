/**
 * The eleven as the batting side of a ground's scoreboard (2026-11-01; scoreboard 2026-11-03, after
 * the Adelaide Oval and WACA boards): slots 1 to 11 painted down the side, a name plate in each
 * filled slot with the keeper's dagger and the captain's (c), his description under it, his batting
 * and bowling numbers for that slot on digit tiles, and a blank plate for every slot still to fill.
 * Screens pass the action for each row (Place in the draft, Swap in the lineup); the sheet only draws.
 */

import type { ReactNode } from "react";
import type { PoolPlayer, Slot } from "../game/types.ts";
import { fullName, teamLabel } from "../lib/names.ts";
import { Digits, bowlingTypeName, roleLine } from "./PlayerCard.tsx";

export interface SheetRow {
  slot: Slot;
  player: PoolPlayer | null;
  /** The player's batting number in this slot, when it differs from his headline number. */
  batHere: number | null;
  /** His bowling number in this World Cup; the card's own number when not given. */
  bowlHere?: number | null;
  /** The designated keeper: he keeps and does not bowl, whatever his bowling number. */
  keeps?: boolean;
  /** The slot is one the selected player may be placed in. */
  open?: boolean;
  action?: ReactNode;
}

/** What the sheet says under a name: the same description as the squad tile ("RFM – RHB lower order"). */
export function sheetLine(p: PoolPlayer): string {
  return roleLine(p);
}

/** The name as a scorecard writes it: dagger before the keeper, (c) after the captain. */
export function sheetName(p: PoolPlayer, captainId: string | null, keeperId: string | null): string {
  return `${p.id === keeperId ? "†" : ""}${fullName(p.id, p.name)}${p.id === captainId ? " (c)" : ""}`;
}

export function TeamSheet({ side, edition, coach, rows, captainId, keeperId, footer, children }: {
  side: string;
  edition: string;
  coach: string | null;
  rows: SheetRow[];
  captainId: string | null;
  keeperId: string | null;
  /** Small print under the list: overs covered, who keeps, what is still needed. */
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const filled = rows.filter((r) => r.player).length;
  return (
    <section className="sheet" aria-label="Team sheet">
      <header className="sheet-head">
        <span className="sheet-kicker">Team sheet</span>
        <h3 className="sheet-title">{side} <span className="sheet-year">{edition}</span></h3>
        <div className="sheet-sub"><span>Coach: {coach ?? "to be named"}</span><span>{filled} of 11 named</span></div>
      </header>
      <div className="sheet-cols" aria-hidden="true"><span /><span /><span>Bat</span><span>Bowl</span><span /></div>
      <ol className="sheet-list">
        {rows.map((r) => {
          const p = r.player;
          const tip = p && r.batHere !== null ? `Headline ${p.bat}; bats ${r.batHere} at No. ${r.slot.index + 1}` : undefined;
          return (
            <li key={r.slot.index} className={`sheet-row ${p ? "named" : "blank"} ${r.open ? "open" : ""}`}>
              <span className="sheet-no">{r.slot.index + 1}</span>
              {p ? (
                <span className="sheet-name">
                  <span className="sheet-player" title={bowlingTypeName(p.bowlingType ?? "")}>{sheetName(p, captainId, keeperId)}</span>
                  <span className="sheet-line">{sheetLine(p)}{p.team && p.editionId ? ` · ${teamLabel(p.team)} ${p.editionId}` : ""}</span>
                </span>
              ) : (
                <span className="sheet-name"><span className="sheet-blank">{r.slot.label}</span></span>
              )}
              <span className="sheet-bat" title={tip}>
                {p ? <><Digits n={p.batShown ? r.batHere ?? p.bat : null} />{p.batShown && r.batHere !== null && r.batHere !== p.bat ? <small>of {p.bat}</small> : null}</> : ""}
              </span>
              <span className="sheet-bat sheet-bowl" title={p && p.bowlShown ? `Bowling ${p.bowl}: powerplay ${p.bowlPhases.pp}, middle ${p.bowlPhases.mid}, death ${p.bowlPhases.death}` : undefined}>
                {p && r.keeps ? <small className="sheet-wk" title="The designated keeper keeps and does not bowl">WK</small> : p ? <><Digits n={p.bowlShown ? r.bowlHere ?? p.bowl : null} />{p.bowlShown && r.bowlHere != null && r.bowlHere !== p.bowl ? <small>of {p.bowl}</small> : null}</> : ""}
              </span>
              <span className="sheet-action">{r.action}</span>
            </li>
          );
        })}
      </ol>
      {footer && <p className="sheet-foot">{footer}</p>}
      {children}
    </section>
  );
}
