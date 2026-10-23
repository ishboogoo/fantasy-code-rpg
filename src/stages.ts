// The first stages of the quest loop, before anyone changes a file:
//   Request (Guild Counter): the Clerk turns your words into a quest.
//   Scout + Plan (War Room): read-only recon and a plan the party will follow.
// Every hero here works with read-only permissions, whatever their rank,
// so these stages are safe to run automatically.

import { ADAPTERS } from "./adapters/index.ts";
import { classify } from "./gate.ts";
import { permissionsFor } from "./rules.ts";
import { QUEST_TYPES, classifyByRules, questTypeOf } from "./quests.ts";
import { spend } from "./economy.ts";
import type { Council } from "./council.ts";
import type { Store } from "./store.ts";
import type { Character, Criterion, Enemy, EnemyKind, PlayStyle, QuestType, Settings, World } from "./types.ts";

const KINDS: EnemyKind[] = ["slime", "goblin", "orc", "golem", "wyvern", "lich", "mimic", "dragon"];
const READ_ONLY = permissionsFor(0);

// ---------- Settings ----------

export function settings(world: World): Settings {
  return (world.settings ??= { playStyle: "story" });
}

export function needsApproval(world: World): boolean {
  return settings(world).playStyle !== "story";
}

/** After three kept quests in Story mode, offer Adventurer once. Never switch without asking. */
export function adventurerOffer(world: World): string | null {
  const s = settings(world);
  if (s.playStyle !== "story" || s.offeredAdventurer) return null;
  const kept = world.battles.filter((b) => b.review === "kept").length;
  if (kept < 3) return null;
  s.offeredAdventurer = true;
  return "You've kept three quests. Want to approve plans and pick parties yourself? Try: savepoint settings --play-style adventurer";
}

export function setPlayStyle(world: World, style: string): PlayStyle {
  if (!["story", "adventurer", "tactician"].includes(style)) throw new Error("Play style must be story, adventurer or tactician.");
  settings(world).playStyle = style as PlayStyle;
  return style as PlayStyle;
}

// ---------- Helpers ----------

/** Who should do a read-only desk job (Clerk, Scout, Planner)? Preferred jobs first, then cheapest. */
export function pickHelper(world: World, prefer: Character["job"][], exclude: Set<string> = new Set()): Character | undefined {
  const ok = world.party.filter((c) => !exclude.has(c.id) && !c.status.includes("resting") && (ADAPTERS[c.adapter].minTier ?? 0) <= c.tier
    && c.adapter !== "shell");
  const rank = (c: Character) => (prefer.includes(c.job) ? 0 : 1) * 10 + (c.mp ? 0 : 1);
  return ok.sort((a, b) => rank(a) - rank(b))[0];
}

async function ask(world: World, c: Character, prompt: string, cwd: string, store: Store): Promise<{ text: string; costGold: number }> {
  const r = await ADAPTERS[c.adapter].run({ character: c, prompt, cwd, permissions: READ_ONLY, maxTurns: 8, goldLimit: 0.25, home: store.root });
  spend(world, c, r.costGold, r.costMp);
  if (r.error && !r.output) throw new Error(`${c.name} couldn't answer: ${r.error}`);
  return { text: r.output, costGold: r.costGold };
}

/** Pull the last JSON object out of a reply. */
export function lastJson<T>(text: string): T | null {
  const end = text.lastIndexOf("}");
  for (let start = text.lastIndexOf("{", end); start >= 0; start = text.lastIndexOf("{", start - 1)) {
    try { return JSON.parse(text.slice(start, end + 1)) as T; } catch { /* try a wider slice */ }
  }
  return null;
}

/**
 * AI-proposed checks are only kept when the Gatekeeper would let a Tier 2 hero run them:
 * no network, no pushing, nothing forbidden. Anything else falls back to a judge.
 */
export function safeCheck(cmd: string | undefined): string | undefined {
  if (!cmd || typeof cmd !== "string" || cmd.length > 300) return undefined;
  return classify("Bash", { command: cmd }, permissionsFor(2)).allow ? cmd : undefined;
}

// ---------- Request: the Guild Counter ----------

interface ClerkReply {
  name?: string; questType?: string; monster?: string; level?: number; goldBudget?: number;
  conditions?: Array<{ id?: string; description?: string; proof?: string; check?: string }>;
  questions?: string[];
}

export interface RequestResult { quest: Enemy; by: string; dropped: string[] }

/** Turn a request in plain words into a quest with victory conditions. */
export async function request(world: World, store: Store, council: Council, text: string, cwd: string, id?: string): Promise<RequestResult> {
  const qid = id ?? nextId(world);
  const clerk = pickHelper(world, ["bard", "mage", "cleric"]);
  let reply: ClerkReply | null = null;
  if (clerk) {
    const prompt = [
      "[CLERK] You are the Clerk at the Guild Counter. Turn this request into a quest. Do not do the work.",
      "Look around the project read-only if it helps you write precise conditions.",
      `Request: ${text}`,
      "",
      "Victory conditions must be specific and checkable. For each, say how it is proven:",
      '- "command": a shell command that exits 0 only when the condition holds (for example a test). Give it as "check". No network, no git push.',
      '- "judge": an independent reviewer reads the work and decides.',
      '- "human": only the person who asked can tell (taste, business choices).',
      "If anything essential is unclear, ask up to 3 short questions instead of guessing.",
      `Quest types: ${Object.keys(QUEST_TYPES).join(", ")}. Monsters: ${KINDS.join(", ")}.`,
      'Reply with JSON only: {"name": "...", "questType": "...", "monster": "...", "level": 1-10, "goldBudget": dollars,',
      '"conditions": [{"id": "short-id", "description": "...", "proof": "command|judge|human", "check": "optional command"}], "questions": []}',
    ].join("\n");
    try { reply = lastJson<ClerkReply>((await ask(world, clerk, prompt, cwd, store)).text); } catch { reply = null; }
  }

  const dropped: string[] = [];
  const conditions: Criterion[] = (reply?.conditions ?? []).filter((c) => c.description).slice(0, 8).map((c, i) => {
    const check = safeCheck(c.check);
    if (c.check && !check) dropped.push(c.check);
    const proof = check ? "command" : c.proof === "human" ? "human" : "judge";
    return { id: slug(c.id ?? `c${i + 1}`) || `c${i + 1}`, description: String(c.description), check, proof, met: false };
  });
  if (!conditions.length) conditions.push({ id: "done", description: text, proof: "human", met: false });

  const typeDecision = council.decide<QuestType>("quest-type", `What kind of quest is "${text}"?`, {
    law: () => { const c = classifyByRules(text); return c ? { answer: c.type, confidence: 0.9, reasons: [`Mentions "${c.matched[0]}"`] } : null; },
    seer: () => {
      const t = reply?.questType as QuestType | undefined;
      return t && QUEST_TYPES[t] ? { answer: t, confidence: 0.6, reasons: [`The Clerk${clerk ? ` (${clerk.name})` : ""} read it as ${QUEST_TYPES[t].label}`] } : null;
    },
  }, qid);
  const questType = typeDecision.answer ?? typeDecision.suggestion;

  const kind = KINDS.includes(reply?.monster as EnemyKind) ? reply!.monster as EnemyKind
    : questType ? QUEST_TYPES[questType].kinds[0] : "goblin";
  const quest: Enemy = {
    id: qid,
    name: (reply?.name && String(reply.name).slice(0, 60)) || text.slice(0, 60),
    kind, questType, level: clampInt(reply?.level, 1, 10, 1),
    description: text, request: text, criteria: conditions,
    budget: { gold: Number.isFinite(reply?.goldBudget) && reply!.goldBudget! > 0 ? Math.min(reply!.goldBudget!, 20) : QUEST_TYPES[questType ?? questTypeOf({ kind })].gold, maxTurns: 20 },
    questions: (reply?.questions ?? []).filter((q) => typeof q === "string" && q.trim()).slice(0, 3),
    approved: !needsApproval(world),
    status: "lurking",
  };
  if (!quest.questions!.length) delete quest.questions;
  world.enemies.push(quest);
  store.log({ type: "request", quest: qid, by: clerk?.id ?? "rules", text });
  return { quest, by: clerk ? clerk.name : "the house rules (no Clerk available)", dropped };
}

/** Add your answers to the Sphinx's questions; the quest is ready once none remain. */
export function answer(quest: Enemy, text: string): void {
  quest.description = `${quest.description}\n\nAnswers from the requester: ${text}`;
  delete quest.questions;
}

// ---------- Scout + Plan: the War Room ----------

export interface WarRoomResult { verdict: "proceed" | "unclear" | "split"; scout?: string; planner?: string; questions: string[]; splits: string[] }

/** Read-only scouting, then a plan. Stops early when the Scout finds the quest unclear or really several quests. */
export async function warRoom(world: World, store: Store, quest: Enemy, cwd: string, leadId?: string): Promise<WarRoomResult> {
  const conditions = quest.criteria.map((k) => `- [${k.id}] ${k.description} (proof: ${k.proof ?? (k.check ? "command" : "judge")})`).join("\n");
  const scout = pickHelper(world, ["thief", "mage"], new Set(leadId ? [leadId] : []));
  const result: WarRoomResult = { verdict: "proceed", questions: [], splits: [] };
  if (scout) {
    const prompt = [
      `[SCOUT] You are ${scout.name}, scouting ahead. Read-only: look, do not change anything.`,
      `Quest: ${quest.name}\n${quest.description}`, "Victory conditions:", conditions,
      "Report: which files matter, what is really going on (reproduce the problem if you can by reading code and tests), and what could go wrong.",
      "End with exactly one line: VERDICT: proceed | VERDICT: unclear | VERDICT: split",
      "If unclear, add lines starting QUESTION: . If it is really several separate quests, add lines starting SPLIT: with each quest.",
    ].join("\n");
    const { text } = await ask(world, scout, prompt, cwd, store);
    result.scout = scout.name;
    quest.scouting = text.trim();
    store.writeScroll(quest.id, `${scout.name} (scouting report)`, text);
    const v = text.match(/VERDICT:\s*(proceed|unclear|split)/i)?.[1]?.toLowerCase() as WarRoomResult["verdict"] | undefined;
    result.verdict = v ?? "proceed";
    result.questions = [...text.matchAll(/^QUESTION:\s*(.+)$/gim)].map((m) => m[1].trim()).slice(0, 3);
    result.splits = [...text.matchAll(/^SPLIT:\s*(.+)$/gim)].map((m) => m[1].trim()).slice(0, 5);
    if (result.verdict === "unclear") { quest.questions = result.questions.length ? result.questions : ["The scout couldn't tell what's wanted. Can you say more?"]; return result; }
    if (result.verdict === "split") return result;
  }
  const planner = pickHelper(world, ["mage", "fighter"], new Set(scout ? [scout.id] : []));
  if (planner) {
    const prompt = [
      `[PLAN] You are ${planner.name}, the strategist. Read-only: plan, do not change anything.`,
      `Quest: ${quest.name}\n${quest.description}`, "Victory conditions:", conditions,
      quest.scouting ? `Scouting report:\n${quest.scouting}` : "",
      "Write a short numbered plan: the steps, the files to touch, how each victory condition will be proven, the main risks, and a rough cost.",
    ].join("\n");
    const { text } = await ask(world, planner, prompt, cwd, store);
    result.planner = planner.name;
    quest.plan = text.trim();
    store.writeScroll(quest.id, `${planner.name} (plan)`, text);
  }
  if (needsApproval(world)) quest.approved = false; // a new plan needs your nod
  return result;
}

// ---------- Small utils ----------

function nextId(world: World): string {
  let n = world.enemies.length + 1;
  while (world.enemies.some((e) => e.id === `q${n}`)) n++;
  return `q${n}`;
}
function slug(s: string): string { return String(s).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24); }
function clampInt(v: unknown, lo: number, hi: number, d: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
}
