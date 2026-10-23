// The Council: every decision in the quest loop is answered by the cheapest
// seat that is sure enough, written down, and later checked against what
// really happened (see docs/DESIGN_PLAN.md → "The Council").
//
//   1 law    fixed rules               free, instant
//   2 ledger win records and stats      free, milliseconds
//   3 seer   a cheap, fast model        (adapter, not built yet)
//   4 trial  run it, then vote          (battle.ts runs checks; cross-vendor vote not built yet)
//   5 you    the Guild Master
//
// A seat answers with a confidence. Below the bar for that kind of decision,
// the question passes up. If nobody is sure, the decision goes to you, carrying
// the best guess so far as a suggestion.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export type Seat = "law" | "ledger" | "seer" | "trial" | "you";
export const SEATS: Seat[] = ["law", "ledger", "seer", "trial", "you"];

/** Kinds of decision the loop makes. Each has its own "sure enough" bar. */
export type DecisionKind = "quest-type" | "party-lead" | "judge" | "risk" | "stuck" | "proof" | "compare";

/** Default bars: 0.95 for decisions that are hard to undo, 0.85 for easy-to-undo ones. Debrief data recalibrates them. */
export const DEFAULT_BARS: Record<DecisionKind, number> = {
  "quest-type": 0.85, "party-lead": 0.85, judge: 0.85, risk: 0.95, stuck: 0.85, proof: 0.95, compare: 0.95,
};

export interface SeatAnswer<T> { answer: T; confidence: number; reasons: string[]; costGold?: number }
/** A seat abstains by returning null. */
export type SeatFn<T> = () => SeatAnswer<T> | null;

export interface Decision<T = unknown> {
  id: string;
  kind: DecisionKind;
  /** The quest this decision belongs to, so the Debrief can attach the outcome. */
  questId?: string;
  question: string;
  /** The seat that answered, or "you" when nobody was sure enough. */
  seat: Seat;
  answer: T | null;
  /** When the decision went to you: the best guess from the seats below, offered as a suggestion. */
  suggestion?: T;
  confidence: number;
  reasons: string[];
  costGold: number;
  ms: number;
  at: string;
}

export type Outcome = "right" | "wrong";

export class Council {
  readonly dir: string;
  readonly bars: Record<DecisionKind, number>;

  constructor(chronicleDir: string, bars: Partial<Record<DecisionKind, number>> = {}) {
    this.dir = chronicleDir;
    this.bars = { ...DEFAULT_BARS, ...bars };
  }

  private get decisionsFile(): string { return join(this.dir, "decisions.jsonl"); }
  private get outcomesFile(): string { return join(this.dir, "outcomes.jsonl"); }

  /** Ask the seats in order; the first one sure enough answers. Every decision is written down. */
  decide<T>(kind: DecisionKind, question: string, seats: Partial<Record<Seat, SeatFn<T>>>, questId?: string): Decision<T> {
    const t0 = performance.now();
    const bar = this.bars[kind];
    let best: (SeatAnswer<T> & { seat: Seat }) | null = null;
    let cost = 0;
    for (const seat of SEATS) {
      if (seat === "you") break;
      const fn = seats[seat];
      if (!fn) continue;
      const a = fn();
      if (!a) continue;
      cost += a.costGold ?? 0;
      if (!best || a.confidence > best.confidence) best = { ...a, seat };
      if (a.confidence >= bar) {
        return this.write({ kind, question, questId, seat, answer: a.answer, confidence: a.confidence, reasons: a.reasons,
          costGold: cost, ms: performance.now() - t0 });
      }
    }
    return this.write({ kind, question, questId, seat: "you", answer: null, suggestion: best?.answer,
      confidence: best?.confidence ?? 0,
      reasons: best ? [`Best guess from the ${best.seat} (${Math.round(best.confidence * 100)}% sure, bar is ${Math.round(bar * 100)}%)`, ...best.reasons] : ["No seat could answer"],
      costGold: cost, ms: performance.now() - t0 });
  }

  private write<T>(d: Omit<Decision<T>, "id" | "at">): Decision<T> {
    const full: Decision<T> = { id: randomUUID().slice(0, 8), at: new Date().toISOString(), ...d, ms: +d.ms.toFixed(2) };
    mkdirSync(this.dir, { recursive: true });
    appendFileSync(this.decisionsFile, JSON.stringify(full) + "\n");
    return full;
  }

  decisions(): Decision[] {
    if (!existsSync(this.decisionsFile)) return [];
    return readFileSync(this.decisionsFile, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Decision);
  }

  /** The Debrief marks a decision right or wrong once the result is known. Append-only; the latest mark wins. */
  markOutcome(decisionId: string, outcome: Outcome, note = ""): void {
    mkdirSync(this.dir, { recursive: true });
    appendFileSync(this.outcomesFile, JSON.stringify({ decisionId, outcome, note, at: new Date().toISOString() }) + "\n");
  }

  outcomes(): Map<string, Outcome> {
    const m = new Map<string, Outcome>();
    if (!existsSync(this.outcomesFile)) return m;
    for (const l of readFileSync(this.outcomesFile, "utf8").split("\n").filter(Boolean)) {
      const o = JSON.parse(l) as { decisionId: string; outcome: Outcome };
      m.set(o.decisionId, o.outcome);
    }
    return m;
  }

  /** How often each seat has been right, per kind of decision. This is the Council chamber's wall. */
  accuracy(): Array<{ kind: DecisionKind; seat: Seat; decided: number; judged: number; right: number }> {
    const out = this.outcomes();
    const rows = new Map<string, { kind: DecisionKind; seat: Seat; decided: number; judged: number; right: number }>();
    for (const d of this.decisions()) {
      const k = `${d.kind}|${d.seat}`;
      const r = rows.get(k) ?? { kind: d.kind, seat: d.seat, decided: 0, judged: 0, right: 0 };
      r.decided++;
      const o = out.get(d.id);
      if (o) { r.judged++; if (o === "right") r.right++; }
      rows.set(k, r);
    }
    return [...rows.values()].sort((a, b) => a.kind.localeCompare(b.kind) || SEATS.indexOf(a.seat) - SEATS.indexOf(b.seat));
  }
}

// ---------- The Ledger's maths ----------

/** Small seeded generator so the Ledger is reproducible in tests and replays. */
export function seeded(seed = 1): () => number {
  let h = seed >>> 0 || 1;
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-12), v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Gamma(shape, 1) sample (Marsaglia–Tsang), valid for shape > 0. */
function gamma(shape: number, rand: () => number): number {
  if (shape < 1) return gamma(shape + 1, rand) * Math.pow(Math.max(rand(), 1e-12), 1 / shape);
  const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do { x = gaussian(rand); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = rand();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** One draw from Beta(a, b). */
export function betaSample(a: number, b: number, rand: () => number): number {
  const x = gamma(a, rand), y = gamma(b, rand);
  return x / (x + y);
}

export interface Record2 { successes: number; failures: number }

/**
 * Probability that each option is the best, by Thompson sampling from Beta(1 + wins, 1 + losses).
 * With little data the answer is spread out (low confidence), so the Council passes the question up.
 */
export function probabilityBest(records: Map<string, Record2>, draws = 400, rand = seeded(7)): Map<string, number> {
  const ids = [...records.keys()];
  const wins = new Map(ids.map((id) => [id, 0]));
  if (!ids.length) return wins;
  for (let i = 0; i < draws; i++) {
    let bestId = ids[0], bestV = -1;
    for (const id of ids) {
      const r = records.get(id)!;
      const v = betaSample(1 + r.successes, 1 + r.failures, rand);
      if (v > bestV) { bestV = v; bestId = id; }
    }
    wins.set(bestId, wins.get(bestId)! + 1);
  }
  return new Map(ids.map((id) => [id, wins.get(id)! / draws]));
}
