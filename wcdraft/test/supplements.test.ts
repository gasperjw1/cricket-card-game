/**
 * Biography supplement: the R data reader and the snapshot join.
 * Skipped when the supplements have not been fetched (`npm run data:fetch`).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isKeeperRole, loadPlayerMeta, normaliseBattingStyle, normaliseBowlingStyle, supplementsReady } from "../src/cricinfo/player-meta.js";

describe("bowling-style normalisation", () => {
  it("maps the Cricinfo vocabulary (both spelling eras) to our codes", () => {
    const cases: [string, string][] = [
      ["Right arm Fast", "RF"], ["Right-arm fast", "RF"], ["Right arm Fast medium", "RFM"], ["Right arm Medium fast", "RFM"],
      ["Left-arm medium-fast", "LFM"], ["Right arm Medium", "RM"], ["Right arm Slow", "RM"], ["Left arm Fast", "LF"], ["Left arm Medium", "LM"],
      ["Right arm Offbreak", "OB"], ["Right-arm offbreak", "OB"], ["Legbreak", "LB"], ["Legbreak Googly", "LB"],
      ["Slow Left arm Orthodox", "SLA"], ["Slow left-arm orthodox", "SLA"], ["Left arm Wrist spin", "SLW"],
      ["Right arm Offbreak, Legbreak Googly", "OB"], ["Right arm Bowler", ""],
    ];
    for (const [raw, code] of cases) assert.equal(normaliseBowlingStyle(raw), code, raw);
  });

  it("maps batting styles and keeper roles", () => {
    assert.equal(normaliseBattingStyle("Right hand Bat"), "R");
    assert.equal(normaliseBattingStyle("Left-hand bat"), "L");
    assert.equal(normaliseBattingStyle(null), "");
    assert.equal(isKeeperRole("Wicketkeeper Batter"), true);
    assert.equal(isKeeperRole("Top order Batter"), false);
  });
});

describe("player_meta snapshot", { skip: !supplementsReady() && "supplements not fetched" }, () => {
  it("parses the bzip2 .rda into the documented 16,101-row frame keyed by Cricsheet id", () => {
    const { byCricsheetId, byCricinfoId, rows } = loadPlayerMeta();
    assert.equal(rows, 16101);
    assert.ok(byCricsheetId.size > 15000);
    const kohli = byCricinfoId.get("253802");
    assert.ok(kohli, "Virat Kohli (cricinfo 253802) missing");
    assert.equal(kohli.cricsheetId, "ba607b88");
    assert.equal(kohli.dob, "1988-11-05");
    assert.equal(normaliseBattingStyle(kohli.battingStyle), "R");
  });
});
