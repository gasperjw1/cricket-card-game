import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute path of the `wcdraft/` package root. */
export const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export const paths = {
  cache: resolve(PACKAGE_ROOT, ".cache"),
  config: resolve(PACKAGE_ROOT, "data/config"),
  labels: resolve(PACKAGE_ROOT, "data/labels"),
  out: resolve(PACKAGE_ROOT, "data/out"),
  /** The card-game roster; used only to pre-fill hand labels. */
  cardsJson: resolve(PACKAGE_ROOT, "../shared/src/data/cards.json"),
} as const;

export function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

/** Pretty-printed by default; `compact` for bulky data tables nobody reads by eye. */
export function writeJson(file: string, value: unknown, opts: { compact?: boolean } = {}): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, (opts.compact ? JSON.stringify(value) : JSON.stringify(value, null, 2)) + "\n");
}

export function writeText(file: string, text: string): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}
