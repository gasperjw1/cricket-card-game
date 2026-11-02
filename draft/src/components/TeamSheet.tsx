/**
 * The eleven as a team sheet (decided 2026-11-01): the side's batting card as it is pinned to the
 * dressing-room wall. Numbered 1 to 11, full names, the keeper's dagger and the captain's (c),
 * hand and bowling code under each name, the batting number for the slot on the right, and a
 * pencilled line for every position still to fill. Screens pass the action for each row (a
 * "Place here" button in the draft, move arrows in the lineup); the sheet itself only draws.
 */

import type { ReactNode } from "react";
import type { PoolPlayer, Slot } from "../game/types.ts";
import { fullName } from "../lib/names.ts";
import { bowlingTypeName } from "./PlayerCard.tsx";

export interface SheetRow {
  slot: Slot;
  player: PoolPlayer | null;
  /** The player's batting number in this slot, when it differs from his headline number. */
  batHere: number | null;
  /** The slot is one the selected player may be placed in. */
  open?: boolean;
  action?: ReactNode;
}

/** "RHB · RFM", "LHB", "RHB · OB": what the sheet says under a name. */
export function sheetLine(p: PoolPlayer): string {
  const parts: string[] = [];
  if (p.hand) parts.push(p.hand === "L" ? "LHB" : "RHB");
  const bowls = p.bowlingType && p.bowlingType !== "none" && (p.bowlShown || p.role === "bowler" || p.role === "all-rounder");
  if (bowls) parts.push(p.bowlingType!);
  return parts.join(" · ");
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
                  <span className="sheet-line">{sheetLine(p)}{p.team && p.editionId ? ` · ${p.team} ${p.editionId}` : ""}</span>
                </span>
              ) : (
                <span className="sheet-name"><span className="sheet-blank">{r.slot.label}</span></span>
              )}
              <span className="sheet-bat" title={tip}>
                {p && p.batShown ? <>{r.batHere ?? p.bat}{r.batHere !== null && r.batHere !== p.bat ? <small> of {p.bat}</small> : null}</> : p ? <small>bowls</small> : ""}
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
