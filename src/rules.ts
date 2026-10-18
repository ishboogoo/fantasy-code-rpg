// The rulebook: every number from docs/WORLD.md lives here, so balance
// changes are one-file PRs. Pure functions only, no I/O.

import type { Character, Enemy, EnemyKind, JobLine, Outcome, Permissions, Tier, TrackRecord, Verdict } from "./types.ts";

// ---------- Classes ----------

export const JOB_TITLES: Record<JobLine, [string, string, string, string]> = {
  fighter: ["Fighter", "Knight", "Paladin", "Champion"],
  mage: ["Mage", "Wizard", "Archmage", "Sage"],
  cleric: ["Cleric", "Priest", "Bishop", "Saint"],
  thief: ["Thief", "Ranger", "Ninja", "Shadowmaster"],
  bard: ["Bard", "Minstrel", "Troubadour", "Maestro"],
};

export const JOB_ROLE: Record<JobLine, string> = {
  fighter: "Implementer. Write the code that satisfies the acceptance criteria.",
  mage: "Architect and researcher. Investigate, plan, and design before anyone builds.",
  cleric: "Reviewer and tester. Verify work, write tests, heal what's broken.",
  thief: "Scout and debugger. Map unfamiliar code and find the root cause of bugs.",
  bard: "Documentarian. Write clear docs, changelogs, and release notes.",
};

export function title(c: Pick<Character, "job" | "tier">): string {
  return c.tier === 0 ? "Novice" : JOB_TITLES[c.job][c.tier - 1];
}

// ---------- Tiers & permissions ----------

export interface TierRule { minLevel: number; minRel: number; minBattles: number }

export const TIER_RULES: Record<Tier, TierRule> = {
  0: { minLevel: 1, minRel: 0, minBattles: 0 },
  1: { minLevel: 3, minRel: 0.5, minBattles: 5 },
  2: { minLevel: 8, minRel: 0.7, minBattles: 15 },
  3: { minLevel: 15, minRel: 0.8, minBattles: 30 },
  4: { minLevel: 25, minRel: 0.9, minBattles: 60 },
};

export const CURSE_MARGIN = 0.1;

export function permissionsFor(tier: Tier): Permissions {
  return {
    read: true,
    write: tier >= 1,
    exec: tier >= 2,
    network: tier >= 3,
    openPr: tier >= 3,
    merge: tier >= 4,
    recruit: tier >= 4,
    maxGoldPerBattle: [0.25, 1, 3, 10, 30][tier],
  };
}

// ---------- Enemies ----------

export const WEAKNESS: Record<EnemyKind, JobLine[]> = {
  slime: ["fighter", "mage", "cleric", "thief", "bard"],
  goblin: ["thief", "cleric"],
  orc: ["fighter"],
  golem: ["fighter", "mage"],
  wyvern: ["mage", "thief"],
  lich: ["thief", "cleric"],
  mimic: ["bard"],
  dragon: [],
};

export const ENEMY_ICON: Record<EnemyKind, string> = {
  slime: "🟢", goblin: "👺", orc: "🐗", golem: "🗿",
  wyvern: "🐉", lich: "💀", mimic: "📜", dragon: "🐲",
};

// ---------- XP & levels ----------

export function xpToNext(level: number): number {
  return Math.round(50 * Math.pow(level, 1.8));
}

export function baseXp(enemy: Pick<Enemy, "level" | "criteria">): number {
  return 20 * enemy.level * (1 + 0.15 * enemy.criteria.length);
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}

export interface PerformanceInput {
  verdict: Verdict;
  cost: number;     // gold-equivalent spent
  budget: number;   // gold-equivalent allowed (0 = no budget → full efficiency)
  turns: number;
  maxTurns: number;
}

export function performance(p: PerformanceInput): number {
  const efficiency = p.budget > 0 ? clamp01(1 - p.cost / p.budget) : 1;
  const speed = p.maxTurns > 0 ? clamp01(1 - p.turns / p.maxTurns) : 1;
  return (
    0.5 * clamp01(p.verdict.correctness) +
    0.2 * clamp01(p.verdict.quality) +
    0.2 * efficiency +
    0.1 * speed
  );
}

export function xpAward(enemy: Enemy, job: JobLine, perf: number, share: number, outcome: Outcome): number {
  if (outcome === "critical") return 0;
  const bonus = WEAKNESS[enemy.kind].includes(job) ? 1.25 : 1;
  return Math.round(baseXp(enemy) * perf * bonus * share);
}

/** Apply XP and return how many levels were gained. Mutates the character. */
export function gainXp(c: Character, amount: number): number {
  c.xp += amount;
  c.totalXp += amount;
  let gained = 0;
  while (c.xp >= xpToNext(c.level)) {
    c.xp -= xpToNext(c.level);
    c.level += 1;
    gained += 1;
  }
  return gained;
}

// ---------- Reliability ----------

export function trialFor(outcome: Outcome, correctness: number): { s: number; f: number } {
  switch (outcome) {
    case "victory": return { s: 1, f: 0 };
    case "retreat": return { s: clamp01(correctness), f: 1 - clamp01(correctness) };
    case "defeat": return { s: 0, f: 1 };
    case "critical": return { s: 0, f: 3 };
  }
}

/** Wilson score lower bound (z = 1.96). Works with fractional trial counts. */
export function reliability(r: TrackRecord | undefined): number {
  if (!r) return 0;
  const n = r.successes + r.failures;
  if (n <= 0) return 0;
  const z = 1.96;
  const p = r.successes / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return Math.max(0, (centre - margin) / denom);
}

export function recordFor(c: Character, job: JobLine = c.job): TrackRecord {
  return c.records[job] ?? (c.records[job] = { successes: 0, failures: 0, battles: 0 });
}

export function canPromote(c: Character): boolean {
  if (c.tier >= 4) return false;
  const next = (c.tier + 1) as Tier;
  const rule = TIER_RULES[next];
  const rec = recordFor(c);
  return c.level >= rule.minLevel && reliability(rec) >= rule.minRel && rec.battles >= rule.minBattles;
}

export function shouldCurse(c: Character): boolean {
  if (c.tier === 0) return false;
  const rule = TIER_RULES[c.tier];
  const rec = recordFor(c);
  // Give new tiers a grace period of 5 battles before judging them.
  return rec.battles >= rule.minBattles + 5 && reliability(rec) < rule.minRel - CURSE_MARGIN;
}

/** Promote or curse as many steps as the rules allow. Returns what happened. */
export function settleTier(c: Character): "promoted" | "cursed" | null {
  if (shouldCurse(c)) {
    c.tier = (c.tier - 1) as Tier;
    if (!c.status.includes("cursed")) c.status.push("cursed");
    return "cursed";
  }
  if (canPromote(c)) {
    c.tier = (c.tier + 1) as Tier;
    c.status = c.status.filter((s) => s !== "cursed");
    return "promoted";
  }
  return null;
}
