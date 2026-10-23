// The battle loop: save point → party takes turns (sharing the Chronicle) →
// an independent judge scores → XP, reliability, promotions, curses.

import { randomUUID } from "node:crypto";
import { ADAPTERS } from "./adapters/index.ts";
import { runProcess } from "./adapters/adapter.ts";
import { canAfford, refillMp, spend } from "./economy.ts";
import {
  JOB_ROLE, gainXp, performance, permissionsFor, recordFor, settleTier, title, trialFor, xpAward,
} from "./rules.ts";
import type { Store } from "./store.ts";
import type { BattleReport, Character, Enemy, InstanceInfo, Outcome, Verdict, World } from "./types.ts";
import { canIsolate, createInstance, discard, keep, savePoint, changes } from "./instance.ts";
import { questTypeOf } from "./quests.ts";
import type { Council } from "./council.ts";

export type JudgeSpec = { kind: "tests" } | { kind: "character"; id: string } | { kind: "auto" };

export interface BattleOptions {
  world: World;
  store: Store;
  enemyId: string;
  partyIds: string[];
  judge: JudgeSpec;
  cwd: string;
  onEvent?: (line: string) => void;
  /** Run in a private copy of the project. Default: yes, whenever the folder is a git repository with a commit. */
  isolate?: boolean;
  /** When given, the Debrief marks the Council's decisions for this quest right or wrong. */
  council?: Council;
}

export function buildPrompt(c: Character, enemy: Enemy, store: Store): string {
  const p = permissionsFor(c.tier);
  const can = Object.entries(p).filter(([k, v]) => v === true && k !== "read").map(([k]) => k);
  const cannot = Object.entries(p).filter(([, v]) => v === false).map(([k]) => k);
  return [
    `You are ${c.name}, a Tier ${c.tier} ${title(c)} in a software party.`,
    `Role: ${JOB_ROLE[c.job]}`,
    `Permissions this battle: read${can.length ? ", " + can.join(", ") : ""}. Not permitted: ${cannot.join(", ") || "nothing"}.`,
    `(The harness enforces these. Attempts beyond them are recorded as critical failures.)`,
    "",
    `# Quest: ${enemy.name}`,
    enemy.description,
    "",
    "## Acceptance criteria",
    ...enemy.criteria.map((k) => `- [${k.id}] ${k.description}${k.met ? " (already met)" : ""}`),
    "",
    "## Project lore (shared by the whole party)",
    store.lore().trim() || "(none yet)",
    "",
    "## Quest scroll (notes from party members so far)",
    store.scroll(enemy.id).trim() || "(empty — you're first)",
    "",
    "Do your part. End your reply with a short handoff note for the next party member.",
    "For each criterion you believe you completed, add a line `DONE: <id>`. These are claims; an independent judge verifies them.",
  ].join("\n");
}

async function runChecks(enemy: Enemy, cwd: string): Promise<Set<string>> {
  const met = new Set<string>();
  for (const k of enemy.criteria) {
    if (!k.check) continue;
    const r = await runProcess("sh", ["-c", k.check], { cwd, timeoutMs: 10 * 60_000 });
    if (r.code === 0) met.add(k.id);
  }
  return met;
}

async function judgeBattle(opts: BattleOptions, enemy: Enemy, fighters: Set<string>, cwd: string): Promise<Verdict & { costGold: number }> {
  const { world, store, judge } = opts;
  const met = await runChecks(enemy, cwd);
  const unchecked = enemy.criteria.filter((k) => !k.check);
  let quality = 0.5;
  let notes = met.size ? `Tests confirmed: ${[...met].join(", ")}.` : "";
  let judgedBy = "tests";
  let costGold = 0;

  const judgeId = judge.kind === "character" ? judge.id
    : judge.kind === "auto" ? world.party.find((c) => c.job === "cleric" && !fighters.has(c.id))?.id
    : undefined;

  if (judgeId && unchecked.length) {
    if (fighters.has(judgeId)) throw new Error("Anti-cheat: a character can't judge a battle it fought in.");
    const j = world.party.find((c) => c.id === judgeId);
    if (!j) throw new Error(`Judge ${judgeId} isn't in the party roster.`);
    const prompt = [
      "[JUDGE] You are an impartial reviewer. Do not trust claims; verify against the work.",
      `Quest: ${enemy.name}\n${enemy.description}`,
      "Criteria:", ...unchecked.map((k) => `* ${k.id}: ${k.description}`),
      "Scroll:", store.scroll(enemy.id),
      'Reply with JSON only: {"met": [criterion ids], "quality": 0..1, "notes": "..."}',
    ].join("\n");
    const r = await ADAPTERS[j.adapter].run({
      character: j, prompt, cwd, permissions: { ...permissionsFor(Math.min(j.tier, 1) as 0 | 1), write: false },
      maxTurns: 5, goldLimit: 0.5,
    });
    costGold += r.costGold;
    spend(world, j, r.costGold, r.costMp);
    try {
      const parsed = JSON.parse(r.output.slice(r.output.indexOf("{"), r.output.lastIndexOf("}") + 1)) as
        { met?: string[]; quality?: number; notes?: string };
      for (const id of parsed.met ?? []) if (unchecked.some((k) => k.id === id)) met.add(id);
      quality = typeof parsed.quality === "number" ? parsed.quality : quality;
      notes = [notes, parsed.notes].filter(Boolean).join(" ");
      judgedBy = met.size && enemy.criteria.some((k) => k.check) ? `tests+${j.id}` : j.id;
    } catch {
      notes += ` Judge ${j.name} returned unreadable output.`;
    }
  } else if (unchecked.length) {
    notes += ` ${unchecked.length} criteria have no check and no judge, so they count as unmet.`;
  }

  for (const k of enemy.criteria) if (met.has(k.id)) k.met = true;
  const correctness = enemy.criteria.length ? enemy.criteria.filter((k) => k.met).length / enemy.criteria.length : 0;
  const outcome: Outcome = correctness >= 1 ? "victory" : correctness > 0 ? "retreat" : "defeat";
  return { outcome, correctness, quality, notes: notes.trim(), judgedBy, costGold };
}

export async function battle(opts: BattleOptions): Promise<BattleReport> {
  const { world, store, cwd } = opts;
  const say = opts.onEvent ?? (() => {});
  const enemy = world.enemies.find((e) => e.id === opts.enemyId);
  if (!enemy) throw new Error(`No enemy with id ${opts.enemyId}`);
  if (enemy.status === "defeated") throw new Error(`${enemy.name} is already defeated.`);
  const party = opts.partyIds.map((id) => {
    const c = world.party.find((x) => x.id === id || x.name.toLowerCase() === id.toLowerCase());
    if (!c) throw new Error(`No character ${id}`);
    const min = ADAPTERS[c.adapter].minTier ?? 0;
    if (c.tier < min) throw new Error(`${c.name} can't join this battle: the ${c.adapter} adapter needs Tier ${min}, ${c.name} is Tier ${c.tier}. Train them on a safer adapter first.`);
    refillMp(c);
    return c;
  });

  // A private copy of the project, with save points after every turn.
  const battleId = randomUUID().slice(0, 8);
  const isolate = opts.isolate ?? await canIsolate(cwd);
  let inst: InstanceInfo | undefined;
  if (isolate) inst = await createInstance(cwd, battleId);
  const workdir = inst?.path ?? cwd;
  const metBefore = new Set(enemy.criteria.filter((k) => k.met).map((k) => k.id));
  store.log({ type: "battle_start", battle: battleId, enemy: enemy.id, party: party.map((c) => c.id), base: inst?.base ?? null, workdir });
  say(`${enemy.name} appears! (Lv ${enemy.level}, ${enemy.criteria.filter((k) => !k.met).length} HP)`);
  if (inst) say(`💾 Save point ${inst.base.slice(0, 8)} · the party fights in its own copy of the project`);
  else say("⚠ Not a git project with a commit, so the party works in your folder directly and nothing can be undone.");
  enemy.status = "engaged";

  let costGold = 0, costMp = 0, turns = 0;
  let critical: string | null = null;
  const budgetGold = enemy.budget.gold ?? 1;
  const maxTurns = enemy.budget.maxTurns ?? 20;

  for (const c of party) {
    const perms = permissionsFor(c.tier);
    const goldLimit = Math.min(budgetGold - costGold, perms.maxGoldPerBattle);
    const broke = canAfford(world, c, Math.min(goldLimit, 0.01), c.mp ? 1 : 0);
    if (broke) { say(`  ${c.name}: ${broke}`); continue; }
    say(`  ${c.name} the ${title(c)} acts…`);
    const before = store.violationCount(c.id);
    const r = await ADAPTERS[c.adapter].run({ character: c, prompt: buildPrompt(c, enemy, store), cwd: workdir, permissions: perms, maxTurns, goldLimit, home: store.root });
    const blocked = store.violationCount(c.id) - before;
    if (blocked > 0 && !r.violation) r.violation = `was stopped by the Gatekeeper ${blocked} time(s)`;
    spend(world, c, r.costGold, r.costMp);
    costGold += r.costGold; costMp += r.costMp; turns += r.turns;
    store.writeScroll(enemy.id, `${c.name} (${title(c)})`, r.output || `(no output${r.error ? ": " + r.error : ""})`);
    if (inst) {
      const sp = await savePoint(inst, `${c.name} (${title(c)}) on ${enemy.id}`);
      if (sp) say(`  💾 Save point ${sp.slice(0, 8)}`);
    }
    if (r.violation) { critical = `${c.name} ${r.violation}`; say(`  ⚠️  ${critical}`); break; }
    if (r.error) say(`  ✖ ${r.error}`);
  }

  const fighters = new Set(party.map((c) => c.id));
  const verdict = await judgeBattle(opts, enemy, fighters, workdir);
  const judgeGold = verdict.costGold; // the referee's fee doesn't count against the party's budget

  if (!critical && enemy.guard) {
    const g = await runProcess("sh", ["-c", enemy.guard], { cwd: workdir, timeoutMs: 15 * 60_000 });
    if (g.code !== 0) critical = "guard check failed (regression)";
  }
  if (!critical && costGold > budgetGold + 1e-9) critical = `overspent: ${costGold.toFixed(3)}G of ${budgetGold}G`;
  if (critical) { verdict.outcome = "critical"; verdict.notes = `${critical}. ${verdict.notes}`; }

  // Rewards
  const share = 1 / party.length;
  const perf = performance({ verdict, cost: costGold, budget: budgetGold, turns, maxTurns: maxTurns * party.length });
  const xpAwarded: Record<string, number> = {};
  const promotions: string[] = [], curses: string[] = [];
  for (const c of party) {
    const xp = xpAward(enemy, c.job, perf, share, verdict.outcome);
    const levels = gainXp(c, xp);
    xpAwarded[c.id] = xp;
    const rec = recordFor(c);
    const t = trialFor(verdict.outcome, verdict.correctness);
    // Every member is accountable for the whole outcome, so trust counts the full trial.
    rec.successes += t.s;
    rec.failures += t.f;
    rec.battles += 1;
    if (levels) say(`  ✨ ${c.name} reached Lv ${c.level}!`);
    const change = settleTier(c);
    if (change === "promoted") { promotions.push(c.id); say(`  🎺 ${c.name} was promoted to ${title(c)} (Tier ${c.tier})!`); }
    if (change === "cursed") { curses.push(c.id); say(`  🩸 ${c.name} is cursed and falls to ${title(c)} (Tier ${c.tier}).`); }
  }

  enemy.status = verdict.outcome === "victory" ? "defeated" : "lurking";

  // Treasure Vault: changes wait for you. Unsafe work (a critical failure) is thrown away at once.
  let review: BattleReport["review"] = undefined;
  if (inst) {
    if (!inst.savePoints.length) { await discard(cwd, inst); review = "nothing"; }
    else if (verdict.outcome === "critical") { await discard(cwd, inst); review = "undone"; say("  🗑 The party's changes were thrown away (critical failure). Your project is untouched."); }
    else {
      review = "pending";
      const ch = await changes(inst);
      say(`  📦 Treasure Vault: ${ch.files.length} file(s) changed${ch.stat ? ` (${ch.stat})` : ""}. Keep or undo: savepoint keep ${battleId} · savepoint undo ${battleId}`);
    }
  }

  // Debrief: the Council learns whether its choice of lead was right.
  if (opts.council && verdict.outcome !== "retreat") {
    const d = opts.council.decisions().filter((x) => x.kind === "party-lead" && x.questId === enemy.id).at(-1);
    const leadId = party[0]?.id;
    if (d && leadId && (d.answer ?? d.suggestion) === leadId) {
      opts.council.markOutcome(d.id, verdict.outcome === "victory" ? "right" : "wrong", `battle ${battleId}`);
    }
  }

  const report: BattleReport = {
    id: battleId, enemyId: enemy.id, questType: questTypeOf(enemy), instance: inst, review,
    newlyMet: enemy.criteria.filter((k) => k.met && !metBefore.has(k.id)).map((k) => k.id),
    party: party.map((c) => ({ characterId: c.id, share })),
    costGold: +(costGold + judgeGold).toFixed(4), costMp, turns, verdict, xpAwarded, promotions, curses,
    at: new Date().toISOString(),
  };
  world.battles.push(report);
  store.log({ type: "battle_end", ...report });
  return report;
}

// ---------- Treasure Vault ----------

function pendingBattle(world: World, battleId: string): BattleReport & { instance: InstanceInfo } {
  const b = world.battles.find((x) => x.id === battleId);
  if (!b) throw new Error(`No battle ${battleId}.`);
  if (!b.instance) throw new Error(`Battle ${battleId} ran directly in your folder; there is nothing to keep or undo.`);
  if (b.review !== "pending") throw new Error(`Battle ${battleId} is already ${b.review ?? "settled"}.`);
  return b as BattleReport & { instance: InstanceInfo };
}

/** Keep the battle's changes: they are merged into your project. */
export async function keepBattle(world: World, store: Store, battleId: string, cwd: string): Promise<string> {
  const b = pendingBattle(world, battleId);
  const msg = await keep(cwd, b.instance);
  b.review = "kept";
  store.log({ type: "review", battle: battleId, decision: "kept" });
  return msg;
}

/**
 * Undo the battle's changes. Your verdict outranks the judge's: an undone victory counts as a
 * loss for everyone in the party, and the Council's choice of lead is marked wrong.
 */
export async function undoBattle(world: World, store: Store, battleId: string, cwd: string, council?: Council): Promise<string> {
  const b = pendingBattle(world, battleId);
  await discard(cwd, b.instance);
  b.review = "undone";
  const enemy = world.enemies.find((e) => e.id === b.enemyId);
  if (enemy) {
    for (const k of enemy.criteria) if (b.newlyMet?.includes(k.id)) k.met = false;
    if (enemy.status === "defeated") enemy.status = "lurking";
  }
  const t = trialFor(b.verdict.outcome, b.verdict.correctness);
  for (const m of b.party) {
    const c = world.party.find((x) => x.id === m.characterId);
    if (!c) continue;
    const rec = recordFor(c);
    rec.successes -= t.s;
    rec.failures += t.s;
    settleTier(c);
  }
  if (council) {
    const d = council.decisions().filter((x) => x.kind === "party-lead" && x.questId === b.enemyId).at(-1);
    if (d) council.markOutcome(d.id, "wrong", `undone at the Treasure Vault (battle ${battleId})`);
  }
  store.log({ type: "review", battle: battleId, decision: "undone" });
  return "Undone: the changes were thrown away and the quest is open again. It counts as a loss for the party.";
}
