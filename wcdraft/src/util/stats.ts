/** Small numeric helpers shared by the analysis accumulators. */

export function round(x: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

/** Safe ratio: returns `fallback` when the denominator is 0. */
export function ratio(num: number, den: number, dp = 3, fallback = 0): number {
  return den === 0 ? fallback : round(num / den, dp);
}

export function pct(num: number, den: number, dp = 1): number {
  return ratio(100 * num, den, dp);
}

export function mean(xs: number[], dp = 2): number {
  return xs.length === 0 ? 0 : round(xs.reduce((a, b) => a + b, 0) / xs.length, dp);
}

export function stddev(xs: number[], dp = 2): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return round(Math.sqrt(v), dp);
}

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[idx] ?? 0;
}

/** Histogram over small integer keys → plain object with string keys, sorted numerically. */
export function histogram(values: Iterable<number>): Record<string, number> {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const out: Record<string, number> = {};
  for (const k of [...counts.keys()].sort((a, b) => a - b)) out[String(k)] = counts.get(k) ?? 0;
  return out;
}

/** Increment `map[key]` by `by` (default 1). */
export function bump<K>(map: Map<K, number>, key: K, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

/** Get-or-create for Map values. */
export function getOrCreate<K, V>(map: Map<K, V>, key: K, make: () => V): V {
  let v = map.get(key);
  if (v === undefined) {
    v = make();
    map.set(key, v);
  }
  return v;
}

/** Months between two ISO dates (approximate, calendar-based). */
export function monthsBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso);
  const b = new Date(toIso);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) + (b.getUTCDate() - a.getUTCDate()) / 30;
}

export function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}
