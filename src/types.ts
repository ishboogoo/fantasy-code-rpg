// Core data types for SAVEPOINT. Plain JSON-serializable shapes only,
// so the whole world state can live in .savepoint/world.json.

export type Tier = 0 | 1 | 2 | 3 | 4;
export type JobLine = "fighter" | "mage" | "cleric" | "thief" | "bard";
export type EnemyKind = "slime" | "goblin" | "orc" | "golem" | "wyvern" | "lich" | "mimic" | "dragon";
export type AdapterKind =
  | "claude-code" | "codex" | "gemini-cli"
  | "anthropic-api" | "openai-compatible"
  | "shell" | "mock";

/** Weighted trial counts for one job line. REL is derived from these. */
export interface TrackRecord {
  successes: number;
  failures: number;
  battles: number;
}

export interface Character {
  id: string;
  name: string;
  adapter: AdapterKind;
  model?: string;
  /** Extra adapter config: command for shell, baseUrl for openai-compatible, etc. */
  adapterConfig?: Record<string, string>;
  job: JobLine;
  tier: Tier;
  level: number;
  xp: number;           // XP accumulated toward the next level
  totalXp: number;
  records: Partial<Record<JobLine, TrackRecord>>;
  status: Array<"cursed" | "resting">;
  /** Subscription quota, for CLI adapters. */
  mp?: { max: number; current: number; refillHours: number; lastRefill: string };
  recruitedAt: string;
}

export interface Criterion {
  id: string;
  description: string;
  /** Optional shell command whose exit code 0 proves the criterion. */
  check?: string;
  met: boolean;
}

export interface Enemy {
  id: string;
  name: string;
  kind: EnemyKind;
  level: number;
  description: string;
  criteria: Criterion[];      // HP bars
  budget: { gold?: number; mp?: number; maxTurns?: number };
  phases?: Enemy[];           // bosses only
  /** Regression guard: a command that must still pass after the battle (e.g. the full test suite). Failing it = critical. */
  guard?: string;
  /** What the quest needs a hero to be allowed to do. Defaults to "write". Drives party recommendations. */
  needs?: "read" | "write" | "exec";
  status: "lurking" | "engaged" | "defeated" | "fled";
}

export type Outcome = "victory" | "retreat" | "defeat" | "critical";

/** What a judge produces. Never filled in by the character that fought. */
export interface Verdict {
  outcome: Outcome;
  correctness: number;  // 0..1
  quality: number;      // 0..1
  notes: string;
  judgedBy: string;     // "tests", "human", or a character id
}

export interface BattleReport {
  id: string;
  enemyId: string;
  party: Array<{ characterId: string; share: number }>;
  costGold: number;
  costMp: number;
  turns: number;
  verdict: Verdict;
  xpAwarded: Record<string, number>;
  promotions: string[];
  curses: string[];
  at: string;
}

export interface World {
  version: 1;
  party: Character[];
  enemies: Enemy[];
  treasury: { gold: number; spent: number };
  battles: BattleReport[];
}

/** What the harness lets an adapter do. Derived from tier, enforced by adapters. */
export interface Permissions {
  read: boolean;
  write: boolean;
  exec: boolean;
  network: boolean;
  openPr: boolean;
  merge: boolean;
  recruit: boolean;
  maxGoldPerBattle: number;
}
