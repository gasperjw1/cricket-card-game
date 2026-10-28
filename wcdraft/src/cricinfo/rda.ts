/**
 * Minimal reader for R's serialization format (`.rda` / `.RData`, XDR, versions 2 and 3),
 * sufficient to load a saved data.frame of character, numeric, integer, logical and Date
 * columns without an R installation or any dependency.
 *
 * Reference: R sources, src/main/serialize.c. Only the SEXP types that appear in plain data
 * files are handled; anything exotic throws with the type number so it can be added.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

type RValue =
  | null
  | { kind: "sym"; name: string }
  | { kind: "char"; value: string | null }
  | { kind: "vec"; type: "lgl" | "int" | "real" | "str" | "list"; values: unknown[]; attrs: Map<string, RValue> }
  | { kind: "pairlist"; items: { tag: string | null; value: RValue }[] }
  | { kind: "other"; type: number };

const T = {
  SYM: 1, LIST: 2, CLO: 3, ENV: 4, PROM: 5, LANG: 6, CHAR: 9, LGL: 10, INT: 13, REAL: 14, CPLX: 15, STR: 16,
  DOT: 17, VEC: 19, EXPR: 20, BCODE: 21, RAW: 24, S4: 25,
  ALTREP: 238, ATTRLIST: 239, ATTRLANG: 240, BASEENV: 241, EMPTYENV: 242, BASENAMESPACE: 247, PERSIST: 248,
  NAMESPACE: 249, PACKAGE: 250, MISSINGARG: 251, UNBOUND: 252, GLOBALENV: 253, NIL: 254, REF: 255,
} as const;

const NA_INT = -2147483648;

class Reader {
  private pos = 0;
  private readonly refs: RValue[] = [];
  constructor(private readonly buf: Buffer) {}

  int(): number {
    const v = this.buf.readInt32BE(this.pos);
    this.pos += 4;
    return v;
  }
  double(): number {
    const v = this.buf.readDoubleBE(this.pos);
    this.pos += 8;
    return v;
  }
  bytes(n: number): Buffer {
    const b = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return b;
  }
  length(): number {
    const n = this.int();
    if (n !== -1) return n;
    const hi = this.int();
    const lo = this.int();
    return hi * 2 ** 32 + (lo >>> 0);
  }

  header(): void {
    const magic = this.bytes(5).toString("latin1");
    if (magic !== "RDX2\n" && magic !== "RDX3\n") throw new Error(`Not an XDR .rda file (magic ${JSON.stringify(magic)})`);
    const fmt = this.bytes(2).toString("latin1");
    if (fmt !== "X\n") throw new Error(`Unsupported .rda format ${JSON.stringify(fmt)} (only XDR)`);
    const version = this.int();
    this.int(); // writer R version
    this.int(); // minimal R version
    if (version === 3) this.bytes(this.int()); // native encoding name
  }

  item(): RValue {
    const flags = this.int();
    const type = flags & 0xff;
    const hasAttr = (flags & (1 << 9)) !== 0;
    const hasTag = (flags & (1 << 10)) !== 0;

    switch (type) {
      case T.NIL:
      case T.EMPTYENV:
      case T.BASEENV:
      case T.GLOBALENV:
      case T.UNBOUND:
      case T.MISSINGARG:
      case T.BASENAMESPACE:
        return null;
      case T.REF: {
        let idx = flags >> 8;
        if (idx === 0) idx = this.int();
        return this.refs[idx - 1] ?? null;
      }
      case T.PERSIST:
      case T.NAMESPACE:
      case T.PACKAGE: {
        const v = this.item(); // STRSXP info
        this.refs.push(v);
        return v;
      }
      case T.SYM: {
        const ch = this.item();
        const v: RValue = { kind: "sym", name: ch && ch.kind === "char" ? (ch.value ?? "") : "" };
        this.refs.push(v);
        return v;
      }
      case T.ENV: {
        this.int(); // locked
        const v: RValue = { kind: "other", type };
        this.refs.push(v);
        this.item(); // enclos
        this.item(); // frame
        this.item(); // hashtab
        this.item(); // attrib
        return v;
      }
      case T.LIST:
      case T.LANG:
      case T.CLO:
      case T.PROM:
      case T.DOT:
      case T.ATTRLIST:
      case T.ATTRLANG: {
        const items: { tag: string | null; value: RValue }[] = [];
        // Pairlists are serialized recursively (CAR then CDR); iterate to avoid deep recursion.
        let f = flags;
        for (;;) {
          const attr = (f & (1 << 9)) !== 0;
          const tagged = (f & (1 << 10)) !== 0;
          if (attr) this.item();
          const tag = tagged ? this.item() : null;
          const value = this.item();
          items.push({ tag: tag && tag.kind === "sym" ? tag.name : null, value });
          f = this.int();
          const t = f & 0xff;
          if (t === T.NIL) break;
          if (t !== T.LIST && t !== T.LANG && t !== T.DOT && t !== T.ATTRLIST && t !== T.ATTRLANG) {
            // CDR is not a pairlist cell (rare); rewind and read it as a value.
            this.pos -= 4;
            items.push({ tag: null, value: this.item() });
            break;
          }
        }
        return { kind: "pairlist", items };
      }
      case T.CHAR: {
        const n = this.int();
        if (n === -1) return { kind: "char", value: null };
        const levels = flags >> 12;
        const enc = levels & (1 << 2) ? "latin1" : "utf8";
        return { kind: "char", value: this.bytes(n).toString(enc) };
      }
      case T.LGL:
      case T.INT: {
        const n = this.length();
        const values = new Array<number | null>(n);
        for (let i = 0; i < n; i += 1) {
          const v = this.int();
          values[i] = v === NA_INT ? null : type === T.LGL ? (v !== 0 ? 1 : 0) : v;
        }
        return this.withAttrs({ kind: "vec", type: type === T.LGL ? "lgl" : "int", values, attrs: new Map() }, hasAttr);
      }
      case T.REAL: {
        const n = this.length();
        const values = new Array<number | null>(n);
        for (let i = 0; i < n; i += 1) {
          const v = this.double();
          values[i] = Number.isNaN(v) ? null : v;
        }
        return this.withAttrs({ kind: "vec", type: "real", values, attrs: new Map() }, hasAttr);
      }
      case T.CPLX: {
        const n = this.length();
        this.bytes(16 * n);
        return this.withAttrs({ kind: "vec", type: "real", values: [], attrs: new Map() }, hasAttr);
      }
      case T.RAW: {
        const n = this.length();
        this.bytes(n);
        return this.withAttrs({ kind: "vec", type: "int", values: [], attrs: new Map() }, hasAttr);
      }
      case T.STR: {
        const n = this.length();
        const values = new Array<string | null>(n);
        for (let i = 0; i < n; i += 1) {
          const ch = this.item();
          values[i] = ch && ch.kind === "char" ? ch.value : null;
        }
        return this.withAttrs({ kind: "vec", type: "str", values, attrs: new Map() }, hasAttr);
      }
      case T.VEC:
      case T.EXPR: {
        const n = this.length();
        const values = new Array<RValue>(n);
        for (let i = 0; i < n; i += 1) values[i] = this.item();
        return this.withAttrs({ kind: "vec", type: "list", values, attrs: new Map() }, hasAttr);
      }
      case T.ALTREP: {
        const info = this.item();
        const state = this.item();
        const attr = this.item();
        const cls = info && info.kind === "pairlist" ? info.items[0]?.value : null;
        const clsName = cls && cls.kind === "sym" ? cls.name : "";
        let out: RValue = state;
        if ((clsName === "compact_intseq" || clsName === "compact_realseq") && state && state.kind === "vec") {
          const [n, start, step] = state.values as number[];
          const values = Array.from({ length: n ?? 0 }, (_, i) => (start ?? 0) + i * (step ?? 1));
          out = { kind: "vec", type: clsName === "compact_intseq" ? "int" : "real", values, attrs: new Map() };
        } else if (clsName === "wrap_integer" || clsName === "wrap_real" || clsName === "wrap_string" || clsName === "wrap_logical" || clsName === "wrap_list") {
          out = state && state.kind === "pairlist" ? state.items[0]?.value ?? null : state;
        } else if (clsName === "deferred_string" && state && state.kind === "pairlist") {
          const inner = state.items[0]?.value;
          if (inner && inner.kind === "vec") out = { kind: "vec", type: "str", values: inner.values.map((v) => (v === null ? null : String(v))), attrs: new Map() };
        }
        if (out && out.kind === "vec" && attr && attr.kind === "pairlist") for (const { tag, value } of attr.items) if (tag) out.attrs.set(tag, value);
        return out;
      }
      case T.S4:
        return this.withAttrs({ kind: "other", type }, hasAttr);
      case T.BCODE:
        throw new Error("Byte-code objects are not supported in data files");
      default:
        throw new Error(`Unsupported R SEXP type ${type} at offset ${this.pos - 4}`);
    }
  }

  private withAttrs(v: RValue, hasAttr: boolean): RValue {
    if (!hasAttr) return v;
    const attrs = this.item();
    if (v && v.kind === "vec" && attrs && attrs.kind === "pairlist") for (const { tag, value } of attrs.items) if (tag) v.attrs.set(tag, value);
    return v;
  }
}

export interface DataFrame {
  columns: string[];
  rows: Record<string, string | number | null>[];
}

/** Load the first data.frame saved in an `.rda` file (gzip, bzip2 or xz compressed, or raw XDR). */
export function readRdaDataFrame(file: string): { name: string; frame: DataFrame } {
  const reader = new Reader(decompress(file));
  reader.header();
  const top = reader.item();
  if (!top || top.kind !== "pairlist") throw new Error("Expected a pairlist of saved objects");
  for (const { tag, value } of top.items) {
    if (value && value.kind === "vec" && value.type === "list" && classOf(value).includes("data.frame")) {
      return { name: tag ?? "", frame: toDataFrame(value) };
    }
  }
  throw new Error("No data.frame found in file");
}

function decompress(file: string): Buffer {
  const head = readFileSync(file).subarray(0, 6);
  if (head[0] === 0x1f && head[1] === 0x8b) return gunzipSync(readFileSync(file));
  if (head.toString("latin1", 0, 3) === "BZh") return execFileSync("bunzip2", ["-kc", file], { maxBuffer: 1 << 30 });
  if (head[0] === 0xfd && head.toString("latin1", 1, 6) === "7zXZ\0") return execFileSync("xz", ["-dc", file], { maxBuffer: 1 << 30 });
  return readFileSync(file);
}

function classOf(v: RValue): string[] {
  const cls = v && v.kind === "vec" ? v.attrs.get("class") : null;
  return cls && cls.kind === "vec" ? (cls.values as string[]) : [];
}

function toDataFrame(v: Extract<RValue, { kind: "vec" }>): DataFrame {
  const namesAttr = v.attrs.get("names");
  const columns = namesAttr && namesAttr.kind === "vec" ? (namesAttr.values as string[]) : v.values.map((_, i) => `V${i + 1}`);
  const cols = v.values.map((c) => (c && (c as RValue)!.kind === "vec" ? (c as Extract<RValue, { kind: "vec" }>) : null));
  const n = Math.max(0, ...cols.map((c) => c?.values.length ?? 0));
  const rows: DataFrame["rows"] = [];
  for (let i = 0; i < n; i += 1) {
    const row: Record<string, string | number | null> = {};
    columns.forEach((name, j) => {
      const col = cols[j];
      let val = (col?.values[i] ?? null) as string | number | null;
      if (col && classOf(col).includes("Date") && typeof val === "number") val = new Date(val * 86400000).toISOString().slice(0, 10);
      if (col && classOf(col).includes("factor") && typeof val === "number") {
        const levels = col.attrs.get("levels");
        val = levels && levels.kind === "vec" ? ((levels.values[val - 1] as string) ?? null) : val;
      }
      row[name] = val;
    });
    rows.push(row);
  }
  return { columns, rows };
}
