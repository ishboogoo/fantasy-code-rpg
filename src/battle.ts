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
import { proofOf, questTypeOf } from "./quests.ts";
import { lastJson } from "./stages.ts";
import { vendor } from "./party.ts";
import type { Council } from "./council.ts";
import { existsSync as exists, readdirSync, rmSync } from "node:fs";
import { join as joinPath } from "node:path";

/** Each battle gets a fresh allowance of "the enemy still stands" pushes. */
function resetStopCounters(home: string, questId: string): void {
  const dir = joinPath(home, "hooks");
  if (!exists(dir)) return;
  for (const f of readdirSync(dir)) if (f.startsWith(`stop-${questId}-`)) rmSync(joinPath(dir, f), { force: true });
}

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
    ...(enemy.plan ? ["## The plan (approved in the War Room; follow it unless it is clearly wrong, and say so if it is)", enemy.plan, ""] : []),
    ...(enemy.scouting ? ["## Scouting report", enemy.scouting, ""] : []),
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

/** Hide who did the work: judges favour writing that sounds like their own company's. */
export function anonymize(text: string, party: Character[]): string {
  let out = text;
  party.forEach((c, i) => {
    const alias = `Worker ${String.fromCharCode(65 + i)}`;
    for (const word of [c.name, c.id, c.adapter, c.model ?? ""].filter((w) => w && w.length > 1)) {
      out = out.replace(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), alias);
    }
  });
  return out;
}

/**
 * Choose up to three judges: never anyone who fought, preferably from a different AI company than
 * every fighter, then Clerics, then the most trusted.
 */
export function chooseJudges(world: World, fighters: Character[], spec: JudgeSpec, max = 3): Character[] {
  if (spec.kind === "tests") return [];
  const fighterIds = new Set(fighters.map((c) => c.id));
  if (spec.kind === "character") {
    if (fighterIds.has(spec.id)) throw new Error("Anti-cheat: a character can't judge a battle it fought in.");
    const j = world.party.find((c) => c.id === spec.id);
    if (!j) throw new Error(`Judge ${spec.id} isn't in the party roster.`);
    return [j];
  }
  const fighterVendors = new Set(fighters.map((c) => vendor(c.adapter)));
  const pool = world.party.filter((c) => !fighterIds.has(c.id) && !c.status.includes("resting") && c.adapter !== "shell");
  const score = (c: Character) => (fighterVendors.has(vendor(c.adapter)) ? 0 : 100) + (c.job === "cleric" ? 10 : 0) + c.tier;
  const ranked = pool.sort((a, b) => score(b) - score(a));
  // One judge per company first, so the vote is genuinely independent.
  const picked: Character[] = [], vendors = new Set<string>();
  for (const c of ranked) if (picked.length < max && !vendors.has(vendor(c.adapter))) { picked.push(c); vendors.add(vendor(c.adapter)); }
  for (const c of ranked) if (picked.length < max && !picked.includes(c)) picked.push(c);
  return picked;
}

async function judgeBattle(opts: BattleOptions, enemy: Enemy, fighters: Character[], cwd: string, inst?: InstanceInfo): Promise<Verdict & { costGold: number; awaitingYou: string[] }> {
  const { world, store, judge, council } = opts;
  // 1. Run it: checks decide whatever they can, before any judge is asked.
  const met = await runChecks(enemy, cwd);
  const awaitingYou = enemy.criteria.filter((k) => !k.met && proofOf(k) === "human").map((k) => k.id);
  const forJudges = enemy.criteria.filter((k) => !k.met && !k.check && proofOf(k) === "judge");
  let notes = met.size ? `Tests confirmed: ${[...met].join(", ")}.` : "";
  const judgedBy: string[] = enemy.criteria.some((k) => k.check) ? ["tests"] : [];
  let costGold = 0;
  const qualities: number[] = [];

  // 2. Then vote: independent judges, authors hidden, each condition scored on its own.
  const judges = forJudges.length ? chooseJudges(world, fighters, judge) : [];
  if (forJudges.length && !judges.length) notes += ` ${forJudges.length} condition(s) need a judge and none is available, so they count as unmet.`;
  if (judges.length) {
    const diff = inst ? (await runProcess("git", ["diff", `${inst.base}..HEAD`], { cwd, timeoutMs: 60_000 })).stdout : "";
    const evidence = anonymize([store.scroll(enemy.id), diff ? `\n## Changes\n\n${diff.slice(0, 20_000)}` : ""].join(""), fighters);
    const votes = new Map<string, boolean[]>(forJudges.map((k) => [k.id, []]));
    for (const [i, j] of judges.entries()) {
      // Each judge sees the conditions in a different order, so position can't sway the vote.
      const order = forJudges.map((k, n) => forJudges[(n + i) % forJudges.length]);
      const prompt = [
        "[JUDGE] You are an impartial reviewer. Do not trust claims; verify them against the work and the changes.",
        "You don't know who did this work. Judge each condition on its own.",
        `Quest: ${enemy.name}\n${enemy.description}`,
        "Conditions:", ...order.map((k) => `* ${k.id}: ${k.description}`),
        "Evidence:", evidence,
        'Reply with JSON only: {"verdicts": {"<condition id>": true or false}, "quality": 0..1, "notes": "..."}',
      ].join("\n");
      const r = await ADAPTERS[j.adapter].run({
        character: j, prompt, cwd, permissions: { ...permissionsFor(Math.min(j.tier, 1) as 0 | 1), write: false },
        maxTurns: 5, goldLimit: 0.5,
      });
      costGold += r.costGold;
      spend(world, j, r.costGold, r.costMp);
      judgedBy.push(j.id);
      const parsed = lastJson<{ verdicts?: Record<string, boolean>; met?: string[]; quality?: number; notes?: string }>(r.output);
      if (!parsed) { notes += ` Judge ${j.name} returned unreadable output.`; continue; }
      for (const k of forJudges) {
        const v = parsed.verdicts ? parsed.verdicts[k.id] : parsed.met?.includes(k.id);
        if (typeof v === "boolean") votes.get(k.id)!.push(v);
      }
      if (typeof parsed.quality === "number") qualities.push(parsed.quality);
      if (parsed.notes) notes += ` ${parsed.notes}`;
    }
    // 3. Each condition is a Council decision: only a unanimous vote counts; a split goes to you.
    for (const k of forJudges) {
      const v = votes.get(k.id)!;
      const yes = v.filter(Boolean).length;
      const seat = () => v.length ? { answer: yes * 2 >= v.length, confidence: Math.max(yes, v.length - yes) / v.length,
        reasons: [`${yes} of ${v.length} judge(s) say it is met`] } : null;
      const d = council ? council.decide<boolean>("proof", `Is "${k.description}" proven?`, { trial: seat }, enemy.id)
        : (() => { const a = seat(); return { answer: a && a.confidence >= 0.95 ? a.answer : null, seat: a && a.confidence >= 0.95 ? "trial" : "you" }; })();
      if (d.answer === true) met.add(k.id);
      else if (d.answer === null && v.length) notes += ` Judges split on ${k.id}; check it yourself at the Treasure Vault.`;
    }
  }

  for (const k of enemy.criteria) if (met.has(k.id)) k.met = true;
  // Conditions only you can prove don't count against the party; they're settled when you Keep.
  const scored = enemy.criteria.filter((k) => !awaitingYou.includes(k.id));
  const correctness = scored.length ? scored.filter((k) => k.met).length / scored.length : awaitingYou.length ? 1 : 0;
  const outcome: Outcome = correctness >= 1 ? "victory" : correctness > 0 ? "retreat" : "defeat";
  if (awaitingYou.length) notes += ` Waiting for you to confirm: ${awaitingYou.join(", ")}.`;
  const quality = qualities.length ? qualities.reduce((a, b) => a + b, 0) / qualities.length : 0.5;
  return { outcome, correctness, quality, notes: notes.trim(), judgedBy: judgedBy.join("+") || "nobody", costGold, awaitingYou };
}

export async function battle(opts: BattleOptions): Promise<BattleReport> {
  const { world, store, cwd } = opts;
  const say = opts.onEvent ?? (() => {});
  const enemy = world.enemies.find((e) => e.id === opts.enemyId);
  if (!enemy) throw new Error(`No enemy with id ${opts.enemyId}`);
  if (enemy.status === "defeated") throw new Error(`${enemy.name} is already defeated.`);
  if (enemy.questions?.length) throw new Error(`A Sphinx blocks the road: ${enemy.name} has open questions. Answer them first (savepoint answer ${enemy.id} "...").`);
  if (enemy.approved === false) throw new Error(`${enemy.name} is waiting for your approval of its victory conditions${enemy.plan ? " and plan" : ""}: savepoint approve ${enemy.id}`);
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
  resetStopCounters(store.root, enemy.id);
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
    const r = await ADAPTERS[c.adapter].run({ character: c, prompt: buildPrompt(c, enemy, store), cwd: workdir, permissions: perms, maxTurns, goldLimit, home: store.root, questId: enemy.id });
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

  const verdict = await judgeBattle(opts, enemy, party, workdir, inst);
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

  // A victory still waiting for your confirmation stays open until you Keep it.
  enemy.status = verdict.outcome === "victory" && !verdict.awaitingYou.length ? "defeated" : "lurking";

  // Treasure Vault: changes wait for you. Unsafe work (a critical failure) is thrown away at once.
  let review: BattleReport["review"] = undefined;
  if (inst) {
    if (!inst.savePoints.length && verdict.awaitingYou.length) { await discard(cwd, inst); inst.savePoints = []; review = "pending"; say(`  📦 Treasure Vault: no files changed, but ${verdict.awaitingYou.length} condition(s) wait for you. Keep or undo: savepoint keep ${battleId} · savepoint undo ${battleId}`); }
    else if (!inst.savePoints.length) { await discard(cwd, inst); review = "nothing"; }
    else if (verdict.outcome === "critical") { await discard(cwd, inst); review = "undone"; say("  🗑 The party's changes were thrown away (critical failure). Your project is untouched."); }
    else {
      review = "pending";
      const ch = await changes(inst);
      say(`  📦 Treasure Vault: ${ch.files.length} file(s) changed${ch.stat ? ` (${ch.stat})` : ""}. Keep or undo: savepoint keep ${battleId} · savepoint undo ${battleId}`);
    }
  } else if (verdict.awaitingYou.length && verdict.outcome !== "critical") {
    review = "pending";
    say(`  📦 ${verdict.awaitingYou.length} condition(s) wait for you: savepoint keep ${battleId} to confirm, savepoint undo ${battleId} to reject.`);
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
    awaitingYou: verdict.awaitingYou.length ? verdict.awaitingYou : undefined,
    party: party.map((c) => ({ characterId: c.id, share })),
    costGold: +(costGold + judgeGold).toFixed(4), costMp, turns, verdict, xpAwarded, promotions, curses,
    at: new Date().toISOString(),
  };
  world.battles.push(report);
  store.log({ type: "battle_end", ...report });
  return report;
}

// ---------- Treasure Vault ----------

function pendingBattle(world: World, battleId: string): BattleReport {
  const b = world.battles.find((x) => x.id === battleId);
  if (!b) throw new Error(`No battle ${battleId}.`);
  if (b.review !== "pending") throw new Error(`Battle ${battleId} has nothing waiting at the Treasure Vault (${b.review ?? "it ran directly in your folder"}).`);
  return b;
}

/** Keep the battle's changes: they are merged into your project. */
export async function keepBattle(world: World, store: Store, battleId: string, cwd: string): Promise<string> {
  const b = pendingBattle(world, battleId);
  const msg = b.instance?.savePoints.length ? await keep(cwd, b.instance) : "Confirmed.";
  b.review = "kept";
  // Keeping is your proof for the conditions only you could judge.
  const enemy = world.enemies.find((e) => e.id === b.enemyId);
  if (enemy && b.awaitingYou?.length) {
    for (const k of enemy.criteria) if (b.awaitingYou.includes(k.id)) k.met = true;
    if (b.verdict.outcome === "victory") enemy.status = "defeated";
  }
  store.log({ type: "review", battle: battleId, decision: "kept" });
  return msg;
}

/**
 * Undo the battle's changes. Your verdict outranks the judge's: an undone victory counts as a
 * loss for everyone in the party, and the Council's choice of lead is marked wrong.
 */
export async function undoBattle(world: World, store: Store, battleId: string, cwd: string, council?: Council): Promise<string> {
  const b = pendingBattle(world, battleId);
  if (b.instance?.savePoints.length) await discard(cwd, b.instance);
  b.review = "undone";
  const enemy = world.enemies.find((e) => e.id === b.enemyId);
  if (enemy) {
    for (const k of enemy.criteria) if (b.newlyMet?.includes(k.id) || b.awaitingYou?.includes(k.id)) k.met = false;
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
  return b.instance?.savePoints.length
    ? "Undone: the changes were thrown away and the quest is open again. It counts as a loss for the party."
    : "Rejected: the quest is open again, and it counts as a loss for the party.";
}
