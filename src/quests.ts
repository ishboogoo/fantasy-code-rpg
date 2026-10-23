// Quest types: the six kinds of work. Each one sets sensible defaults so a
// player never has to configure a quest by hand. Pure data + pure functions.

import type { Enemy, EnemyKind, JobLine, QuestType } from "./types.ts";

export type Formation = "solo" | "relay" | "pincer" | "siege";

export interface QuestTypeRule {
  label: string;
  /** What the lead must be trusted to do. */
  needs: "read" | "write" | "exec";
  formation: Formation;
  /** Default budget in Gold (API dollars) when the request doesn't set one. */
  gold: number;
  /** Jobs that tend to lead this kind of quest. */
  leads: JobLine[];
  /** Monsters this kind of work usually looks like. */
  kinds: EnemyKind[];
  /** What counts as proof of victory, in plain words (shown in the War Room). */
  proof: string;
}

export const QUEST_TYPES: Record<QuestType, QuestTypeRule> = {
  build: { label: "Build", needs: "write", formation: "relay", gold: 2, leads: ["fighter", "mage"], kinds: ["golem", "dragon"],
    proof: "New tests pass, plus a screenshot or demo of it working" },
  fix: { label: "Fix", needs: "write", formation: "relay", gold: 1, leads: ["thief", "fighter"], kinds: ["goblin", "lich", "wyvern"],
    proof: "A test that failed before now passes, and all old tests still pass" },
  improve: { label: "Improve", needs: "write", formation: "solo", gold: 1, leads: ["fighter", "mage"], kinds: ["orc", "golem"],
    proof: "Old tests still pass, and the measured number improved" },
  explore: { label: "Explore", needs: "read", formation: "solo", gold: 0.5, leads: ["mage", "thief"], kinds: ["wyvern"],
    proof: "A short report with sources that you accept" },
  maintain: { label: "Maintain", needs: "exec", formation: "solo", gold: 0.5, leads: ["fighter", "cleric"], kinds: ["slime"],
    proof: "Automatic checks pass" },
  write: { label: "Write", needs: "write", formation: "relay", gold: 0.5, leads: ["bard"], kinds: ["mimic"],
    proof: "The written steps actually work when followed" },
};

/** Keyword rules for the Law seat. Deliberately simple: when more than one type matches, the Law abstains. */
const KEYWORDS: Array<[QuestType, RegExp]> = [
  ["fix", /\b(bug|fix(es|ed)?|error|crash(es|ing)?|fail(s|ing|ure)?|broken|regression|doesn'?t work|not working)\b/i],
  ["improve", /\b(refactor|faster|slow|perf(ormance)?|speed( up)?|clean ?up|simplif(y|ies)|optimi[sz]e|tidy)\b/i],
  ["explore", /\b(which|should we|research|compare|investigate|evaluate|why does|how does|options for|find out)\b/i],
  ["maintain", /\b(upgrade|bump|dependenc(y|ies)|chore|lint|update (the )?(libraries|packages|deps))\b/i],
  ["write", /\b(docs?|readme|guide|documentation|changelog|write[- ]?up|tutorial)\b/i],
  ["build", /\b(add|create|implement|new|feature|support for|build|introduce)\b/i],
];

export interface Classification { type: QuestType; matched: string[] }

/**
 * The Law's answer to "what kind of quest is this?". Returns one type when exactly one
 * family of keywords matches; null when none or several do, so the Council asks a higher seat.
 */
export function classifyByRules(text: string): Classification | null {
  const hits = KEYWORDS.filter(([, re]) => re.test(text));
  if (hits.length !== 1) return null;
  const [type, re] = hits[0];
  return { type, matched: [text.match(re)?.[0] ?? ""] };
}

/** The quest's type, or a guess from its monster when nothing better is known. */
export function questTypeOf(e: Pick<Enemy, "questType" | "kind">): QuestType {
  if (e.questType) return e.questType;
  const found = (Object.keys(QUEST_TYPES) as QuestType[]).find((t) => QUEST_TYPES[t].kinds.includes(e.kind));
  return found ?? "build";
}

/** How each victory condition is proven, filling in the default. */
export function proofOf(c: { check?: string; proof?: "command" | "judge" | "human" }): "command" | "judge" | "human" {
  return c.proof ?? (c.check ? "command" : "judge");
}
