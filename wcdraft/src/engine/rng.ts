/**
 * Seeded random numbers (design spec §7.2: deterministic given a seed, so share links reproduce
 * seasons). splitmix32 to expand a seed, mulberry32 for the stream; both are tiny and well
 * documented, and quality far beyond what a cricket simulation needs.
 */

export class Rng {
  private state: number;

  constructor(seed: number | string) {
    this.state = typeof seed === "number" ? seed >>> 0 : hashString(seed);
    // Warm up so near-identical seeds diverge.
    for (let i = 0; i < 4; i += 1) this.next();
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Index drawn from unnormalised non-negative weights. */
  pick(weights: number[]): number {
    let total = 0;
    for (const w of weights) total += w;
    let u = this.next() * total;
    for (let i = 0; i < weights.length; i += 1) {
      u -= weights[i]!;
      if (u < 0) return i;
    }
    return weights.length - 1;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Standard normal (Box–Muller). */
  normal(): number {
    const u = Math.max(1e-12, this.next()), v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Standard Gumbel noise, for discrete choices with a softmax flavour. */
  gumbel(): number {
    return -Math.log(-Math.log(Math.max(1e-12, this.next())));
  }

  /** A child stream, so sub-simulations stay reproducible independently of call order. */
  fork(label: string): Rng {
    return new Rng(hashString(`${label}:${this.next()}`));
  }
}

export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
