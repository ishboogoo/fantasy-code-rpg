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
import type { BattleReport, Character, Enemy, Outcome, Verdict, World } from "./types.ts";

export type JudgeSpec = { kind: "tests" } | { kind: "character"; id: string } | { kind: "auto" };

export interface BattleOptions {
  world: World;
  store: Store;
  enemyId: string;
  partyIds: string[];
  judge: JudgeSpec;
  cwd: string;
  onEvent?: (line: string) => void;
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

async function judgeBattle(opts: BattleOptions, enemy: Enemy, fighters: Set<string>): Promise<Verdict & { costGold: number }> {
  const { world, store, judge, cwd } = opts;
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

  // Save point
  const head = await runProcess("git", ["rev-parse", "HEAD"], { cwd, timeoutMs: 10_000 });
  const savePoint = head.code === 0 ? head.stdout.trim() : null;
  store.log({ type: "battle_start", enemy: enemy.id, party: party.map((c) => c.id), savePoint });
  say(`${enemy.name} appears! (Lv ${enemy.level}, ${enemy.criteria.filter((k) => !k.met).length} HP)`);
  if (savePoint) say(`💾 Save point ${savePoint.slice(0, 8)}`);
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
    const r = await ADAPTERS[c.adapter].run({ character: c, prompt: buildPrompt(c, enemy, store), cwd, permissions: perms, maxTurns, goldLimit, home: store.root });
    const blocked = store.violationCount(c.id) - before;
    if (blocked > 0 && !r.violation) r.violation = `was stopped by the Gatekeeper ${blocked} time(s)`;
    spend(world, c, r.costGold, r.costMp);
    costGold += r.costGold; costMp += r.costMp; turns += r.turns;
    store.writeScroll(enemy.id, `${c.name} (${title(c)})`, r.output || `(no output${r.error ? ": " + r.error : ""})`);
    if (r.violation) { critical = `${c.name} ${r.violation}`; say(`  ⚠️  ${critical}`); break; }
    if (r.error) say(`  ✖ ${r.error}`);
  }

  const fighters = new Set(party.map((c) => c.id));
  const verdict = await judgeBattle(opts, enemy, fighters);
  const judgeGold = verdict.costGold; // the referee's fee doesn't count against the party's budget

  if (!critical && enemy.guard) {
    const g = await runProcess("sh", ["-c", enemy.guard], { cwd, timeoutMs: 15 * 60_000 });
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
  const report: BattleReport = {
    id: randomUUID().slice(0, 8), enemyId: enemy.id,
    party: party.map((c) => ({ characterId: c.id, share })),
    costGold: +(costGold + judgeGold).toFixed(4), costMp, turns, verdict, xpAwarded, promotions, curses,
    at: new Date().toISOString(),
  };
  world.battles.push(report);
  store.log({ type: "battle_end", ...report });
  return report;
}
