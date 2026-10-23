// Core data types for SAVEPOINT. Plain JSON-serializable shapes only,
// so the whole world state can live in .savepoint/world.json.

export type Tier = 0 | 1 | 2 | 3 | 4;
export type JobLine = "fighter" | "mage" | "cleric" | "thief" | "bard";
export type EnemyKind = "slime" | "goblin" | "orc" | "golem" | "wyvern" | "lich" | "mimic" | "dragon";
/** The six kinds of work. Sets default party, formation, budget and what counts as proof. See src/quests.ts. */
export type QuestType = "build" | "fix" | "improve" | "explore" | "maintain" | "write";
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
  /** How the hero looks. Missing fields are chosen from the hero's id, so a look never changes by itself. */
  look?: { race?: string; build?: "feminine" | "masculine" };
}

export interface Criterion {
  id: string;
  description: string;
  /** Optional shell command whose exit code 0 proves the criterion. */
  check?: string;
  /** How this condition is proven: a runnable check, an independent judge, or you. Defaults: check → "command", else "judge". */
  proof?: "command" | "judge" | "human";
  met: boolean;
}

export interface Enemy {
  id: string;
  name: string;
  kind: EnemyKind;
  /** Which kind of work this is. Classified by the Council when missing. */
  questType?: QuestType;
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
  /** The request in your own words, as given at the Guild Counter. */
  request?: string;
  /** Where the quest came from, such as a GitHub issue URL. */
  source?: string;
  /** Questions the Clerk or a Scout needs answered before anyone fights (a Sphinx blocks the road). */
  questions?: string[];
  /** You approved the victory conditions (and the plan, once there is one). Story mode approves automatically. */
  approved?: boolean;
  /** The War Room's read-only scouting report and plan, handed to the party. */
  scouting?: string;
  plan?: string;
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

/** A private copy of the project for one battle: a git worktree on its own branch. */
export interface InstanceInfo {
  branch: string;
  path: string;
  /** The commit the battle started from (the first save point). */
  base: string;
  /** Commits made after each hero's turn, oldest first. */
  savePoints: string[];
}

export interface BattleReport {
  id: string;
  enemyId: string;
  questType?: QuestType;
  /** Present when the battle ran in its own copy of the project. */
  instance?: InstanceInfo;
  /** Treasure Vault state: changes wait for you to keep or undo them. */
  review?: "pending" | "kept" | "undone" | "nothing";
  /** Victory conditions this battle newly met, so an undo can reopen exactly those. */
  newlyMet?: string[];
  /** Conditions only you can prove; they are met when you Keep the result. */
  awaitingYou?: string[];
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

export type PlayStyle = "story" | "adventurer" | "tactician";

export interface Settings {
  /** How much of the loop you see and approve. New players start in Story. */
  playStyle: PlayStyle;
  /** Set once the game has offered to move you from Story to Adventurer, so it only asks once. */
  offeredAdventurer?: boolean;
  /** Every word in the game's screens. Your heroes still work in whatever language you write to them. */
  language?: "en" | "ja";
}

export interface World {
  version: 1;
  settings?: Settings;
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
