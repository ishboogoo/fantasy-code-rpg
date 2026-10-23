// The battle loop: save point → party takes turns (sharing the Chronicle) →
// an independent judge scores → XP, reliability, promotions, curses.

import { randomUUID } from "node:crypto";
import { ADAPTERS } from "./adapters/index.ts";
import { runProcess } from "./adapters/adapter.ts";
import { canAfford, refillMp, spend } from "./economy.ts";
import {
  JOB_ROLE, gainXp, performance, permissionsFor, recordFor, reliability, settleTier, title, trialFor, xpAward,
} from "./rules.ts";
import type { Store } from "./store.ts";
import type { BattleReport, Character, Enemy, Formation, InstanceInfo, Outcome, SiegePart, Verdict, World } from "./types.ts";
import { canIsolate, createInstance, discard, keep, savePoint, changes, mergeInto } from "./instance.ts";
import { proofOf, questTypeOf } from "./quests.ts";
import { debrief, lastJson, stuckCall, type StuckCall } from "./stages.ts";
import { QUEST_TYPES } from "./quests.ts";
import { vendor } from "./party.ts";
import type { Council, SeatAnswer } from "./council.ts";
import { AskBook, NEED_WORDS } from "./asks.ts";
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
  /** Ask a hero who didn't fight to write the quest's lessons into the Chronicle afterwards. */
  debrief?: boolean;
  /** Pincer: the first two heroes each try their own approach in their own copy; the better one goes to the Vault. */
  formation?: Formation;
}

export function buildPrompt(c: Character, enemy: Enemy, store: Store): string {
  const p = permissionsFor(c.tier);
  const can = Object.entries(p).filter(([k, v]) => v === true && k !== "read").map(([k]) => k);
  const cannot = Object.entries(p).filter(([, v]) => v === false).map(([k]) => k);
  return [
    `You are ${c.name}, a Tier ${c.tier} ${title(c)} in a software party.`,
    `Role: ${JOB_ROLE[c.job]}`,
    `Permissions this battle: read${can.length ? ", " + can.join(", ") : ""}. Not permitted: ${cannot.join(", ") || "nothing"}.`,
    `(The harness enforces these. If you need something one rank above yours, just do it: the Gatekeeper pauses and asks the Guild Master, and asking is never held against you. Forbidden actions, such as touching .savepoint/ or force-pushing, are critical failures.)`,
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
  // No judge to ask (heroes never grade their own work): those conditions go to you, like a split vote.
  if (forJudges.length && !judges.length) { awaitingYou.push(...forJudges.map((k) => k.id)); notes += ` No judge is free (heroes never grade their own work), so you decide ${forJudges.map((k) => k.id).join(", ")}.`; }
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
        maxTurns: 5, goldLimit: 0.5, home: store.root, desk: true,
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

/**
 * Pincer: which of two approaches is better? Run it first (the Law): if one passes more checks, it wins.
 * Otherwise vote (the Trial): judges from other companies compare both, in both orders, authors hidden;
 * a judge whose answer flips with the order cancels itself out. A split leaves both for you to choose.
 */
async function comparePincer(opts: BattleOptions, enemy: Enemy, leads: Character[], insts: InstanceInfo[], battleId: string):
  Promise<{ winner: 0 | 1; sure: boolean; reason: string }> {
  const { world, store } = opts;
  const passed = await Promise.all(insts.map((i) => runChecks(enemy, i.path)));
  const diffs = await Promise.all(insts.map(async (i) => (await runProcess("git", ["diff", `${i.base}..HEAD`], { cwd: i.path, timeoutMs: 60_000 })).stdout.slice(0, 15_000)));
  const law = (): SeatAnswer<0 | 1> | null => passed[0].size === passed[1].size ? null
    : { answer: passed[0].size > passed[1].size ? 0 : 1, confidence: 1, reasons: [`Approach ${passed[0].size > passed[1].size ? "A" : "B"} passes more checks (${Math.max(passed[0].size, passed[1].size)} vs ${Math.min(passed[0].size, passed[1].size)})`] };
  const votes: Array<0 | 1> = [];
  if (!law()) {
    for (const j of chooseJudges(world, leads, opts.judge.kind === "tests" ? { kind: "auto" } : opts.judge)) {
      const ask = async (first: 0 | 1): Promise<0 | 1 | null> => {
        const second = (1 - first) as 0 | 1;
        const prompt = [
          "[COMPARE] You are an impartial reviewer. Two separate solutions to the same quest follow. You don't know who wrote them.",
          `Quest: ${enemy.name}\n${enemy.description}`, "Conditions:", ...enemy.criteria.map((k) => `* ${k.id}: ${k.description}`),
          "Solution 1 (changes):", anonymize(diffs[first], leads) || "(no changes)",
          "Solution 2 (changes):", anonymize(diffs[second], leads) || "(no changes)",
          'Which better meets the conditions with less risk? Reply with JSON only: {"better": "1" or "2" or "tie", "why": "..."}',
        ].join("\n");
        const r = await ADAPTERS[j.adapter].run({ character: j, prompt, cwd: insts[0].path, permissions: { ...permissionsFor(0) }, maxTurns: 5, goldLimit: 0.5, home: store.root, desk: true });
        spend(world, j, r.costGold, r.costMp);
        const b = String(lastJson<{ better?: string }>(r.output)?.better ?? "");
        return b === "1" ? first : b === "2" ? second : null;
      };
      const [x, y] = [await ask(0), await ask(1)];
      if (x !== null && x === y) votes.push(x); // consistent across both orders
    }
  }
  const trial = (): SeatAnswer<0 | 1> | null => {
    if (!votes.length) return null;
    const a = votes.filter((v) => v === 0).length;
    const answer: 0 | 1 = a * 2 >= votes.length ? 0 : 1;
    return { answer, confidence: Math.max(a, votes.length - a) / votes.length, reasons: [`${votes.length} judge(s) gave a consistent answer; ${answer === 0 ? a : votes.length - a} chose approach ${answer === 0 ? "A" : "B"}`] };
  };
  const d = opts.council ? opts.council.decide<0 | 1>("compare", `Which approach to ${enemy.name} is better?`, { law, trial }, enemy.id)
    : (() => { const l = law() ?? trial(); return { answer: l && l.confidence >= 0.95 ? l.answer : null, suggestion: l?.answer, reasons: l?.reasons ?? [] }; })();
  const winner = (d.answer ?? d.suggestion ?? 0) as 0 | 1;
  const sure = d.answer !== null && d.answer !== undefined;
  store.event({ battle: battleId, type: "compare", winner: leads[winner].id, sure });
  return { winner, sure, reason: sure ? `${leads[winner].name}'s approach wins. ${d.reasons[0] ?? ""}` : `The judges couldn't agree; ${leads[winner].name}'s approach goes first, and you choose at the Vault.` };
}

/** At most this many parts run at once in a Siege; the rest wait for a later battle. */
export const MAX_SIEGE_PARTS = 4;

/** What a Siege hero is told about their own part and everyone else's. */
export function siegeBrief(enemy: Enemy, part: SiegePart, others: Array<{ part: SiegePart; hero: Character }>): string {
  const cond = (ids: string[]) => ids.map((id) => enemy.criteria.find((k) => k.id === id)).filter(Boolean).map((k) => `  - [${k!.id}] ${k!.description}`);
  return ["", "", `SIEGE. This quest is split into parts, fought at the same time, each hero in their own copy of the project.`,
    `Your part: ${part.name}`, ...(part.criteria.length ? ["Conditions for your part:", ...cond(part.criteria)] : []),
    `Other parts, being done right now by other heroes: ${others.map((o) => `${o.part.name} (${o.hero.name})`).join("; ") || "none"}.`,
    "Change only what your part needs and don't do the other parts: your work is merged with theirs afterwards, and overlapping edits clash."].join("\n");
}

export async function battle(opts: BattleOptions): Promise<BattleReport> {
  const { world, store, cwd } = opts;
  const battleId = randomUUID().slice(0, 8);
  const emit = (e: Record<string, unknown>) => store.event({ battle: battleId, ...e });
  const say = (line: string) => { opts.onEvent?.(line); emit({ type: "say", text: line.trim() }); };
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
  const isolate = opts.isolate ?? await canIsolate(cwd);
  if (opts.formation === "pincer" && (!isolate || party.length < 2)) throw new Error("Pincer needs two heroes and a git project with a commit (each approach runs in its own copy).");
  if (opts.formation === "siege" && (!isolate || (enemy.parts?.length ?? 0) < 2)) throw new Error(isolate
    ? `Siege needs the quest split into parts first: savepoint split ${enemy.id} --part "name: c1,c2" --part "name: c3" (the War Room suggests splits too).`
    : "Siege needs a git project with a commit (each part runs in its own copy).");
  let inst: InstanceInfo | undefined;
  if (isolate) inst = await createInstance(cwd, battleId);
  const workdir = inst?.path ?? cwd;
  void workdir;
  const metBefore = new Set(enemy.criteria.filter((k) => k.met).map((k) => k.id));
  const startedAt = new Date().toISOString();
  resetStopCounters(store.root, enemy.id);
  const hpLeft = () => enemy.criteria.filter((k) => !k.met).length;
  emit({ type: "battle_start", quest: { id: enemy.id, name: enemy.name, kind: enemy.kind, questType: questTypeOf(enemy), level: enemy.level, hp: hpLeft(), maxHp: enemy.criteria.length },
    party: party.map((c) => c.id), isolated: !!inst });
  store.log({ type: "battle_start", battle: battleId, enemy: enemy.id, party: party.map((c) => c.id), base: inst?.base ?? null, workdir });
  say(`${enemy.name} appears! (Lv ${enemy.level}, ${enemy.criteria.filter((k) => !k.met).length} HP)`);
  if (inst) say(`💾 Save point ${inst.base.slice(0, 8)} · the party fights in its own copy of the project`);
  else say("⚠ Not a git project with a commit, so the party works in your folder directly and nothing can be undone.");
  enemy.status = "engaged";

  let costGold = 0, costMp = 0, turns = 0;
  let critical: string | null = null;
  const budgetGold = enemy.budget.gold ?? 1;
  const maxTurns = enemy.budget.maxTurns ?? 20;

  let pincerLoser: Character | undefined;
  let alternate: InstanceInfo | undefined;
  if (opts.formation === "pincer") {
    if (!inst) throw new Error("Pincer needs a git project: each approach runs in its own copy.");
    if (party.length < 2) throw new Error("Pincer needs two heroes to try two approaches.");
    const [a, b2] = party;
    party.length = 2; // supports sit this one out
    const instB = await createInstance(cwd, `${battleId}-b`);
    say(`  ⚔ Pincer: ${a.name} and ${b2.name} each try their own approach.`);
    const runOne = async (c: Character, where: InstanceInfo, label: string) => {
      const perms = permissionsFor(c.tier);
      const goldLimit = Math.min((budgetGold - costGold) / 2, perms.maxGoldPerBattle);
      emit({ type: "turn", hero: c.id });
      const r = await ADAPTERS[c.adapter].run({ character: c, prompt: buildPrompt(c, enemy, store) + `\n\nYou are approach ${label}; another hero is trying their own approach separately. Do your best version.`,
        cwd: where.path, permissions: perms, maxTurns, goldLimit, home: store.root, questId: enemy.id });
      spend(world, c, r.costGold, r.costMp);
      costGold += r.costGold; costMp += r.costMp; turns += r.turns;
      store.writeScroll(enemy.id, `${c.name} (${title(c)}, approach ${label})`, r.output || `(no output${r.error ? ": " + r.error : ""})`);
      const sp = await savePoint(where, `${c.name} approach ${label} on ${enemy.id}`);
      if (sp) emit({ type: "save_point", hero: c.id, sha: sp.slice(0, 8) });
      return r;
    };
    const [ra, rb] = await Promise.all([runOne(a, inst, "A"), runOne(b2, instB, "B")]);
    if (ra.violation) critical = `${a.name} ${ra.violation}`;
    if (rb.violation) critical = `${b2.name} ${rb.violation}`;
    const pick = await comparePincer(opts, enemy, [a, b2], [inst, instB], battleId);
    say(`  ⚖ ${pick.reason}`);
    const winner = pick.winner === 0 ? inst : instB;
    const loser = pick.winner === 0 ? instB : inst;
    pincerLoser = pick.winner === 0 ? b2 : a;
    if (pick.sure) await discard(cwd, loser);
    else { alternate = loser; say(`  ↔ The other approach is kept too: at the Vault you can keep it instead (savepoint keep ${battleId} --other).`); }
    inst = winner;
    // The winner's lead goes first in the report, so the Council's choice of lead is judged fairly.
    if (pick.winner === 1) party.reverse();
  }
  // Siege: each part is fought at the same time in its own copy, then the parts are merged into the main copy.
  const clashes: string[] = [];
  const siegeParts = new Map<string, SiegePart[]>(); // hero → the parts they took
  if (opts.formation === "siege") {
    if (!inst) throw new Error("Siege needs a git project: each part runs in its own copy.");
    const parts = (enemy.parts ?? []).slice(0, MAX_SIEGE_PARTS);
    if (parts.length < 2) throw new Error(`Siege needs the quest split into parts first: savepoint split ${enemy.id} --part "name: c1,c2" --part "name: c3" (the War Room suggests splits too).`);
    const assign = parts.map((part, i) => ({ part, hero: party.find((c) => c.id === part.hero) ?? party[i % party.length] }));
    say(`  🏰 Siege: ${assign.map((a) => `${a.hero.name} takes ${a.part.name}`).join(" · ")}`);
    // Copies are made one at a time (git locks), then every part is fought at once.
    const copies: InstanceInfo[] = [];
    for (let i = 0; i < assign.length; i++) copies.push(await createInstance(cwd, `${battleId}-p${i + 1}`));
    const goldEach = budgetGold / assign.length;
    const results = await Promise.all(assign.map(async ({ part, hero }, i) => {
      const where = copies[i];
      const perms = permissionsFor(hero.tier);
      emit({ type: "turn", hero: hero.id, part: part.id });
      const before = store.violationCount(hero.id);
      const r = await ADAPTERS[hero.adapter].run({ character: hero, prompt: buildPrompt(hero, enemy, store) + siegeBrief(enemy, part, assign.filter((a) => a.part !== part)),
        cwd: where.path, permissions: perms, maxTurns, goldLimit: Math.min(goldEach, perms.maxGoldPerBattle), home: store.root, questId: enemy.id, criteria: part.criteria });
      if (store.violationCount(hero.id) - before > 0 && !r.violation) r.violation = "was stopped by the Gatekeeper";
      spend(world, hero, r.costGold, r.costMp);
      costGold += r.costGold; costMp += r.costMp; turns += r.turns;
      store.writeScroll(enemy.id, `${hero.name} (${title(hero)}, part: ${part.name})`, r.output || `(no output${r.error ? ": " + r.error : ""})`);
      const sp = await savePoint(where, `${hero.name} (${part.name}) on ${enemy.id}`);
      if (sp) emit({ type: "save_point", hero: hero.id, sha: sp.slice(0, 8) });
      return { part, hero, where, r };
    }));
    for (const x of results) if (x.r.violation && !critical) { critical = `${x.hero.name} ${x.r.violation}`; say(`  ⚠️  ${critical}`); }
    // Merge in the order the parts were listed; a part that clashes with earlier ones is set aside.
    for (const x of results) {
      if (await mergeInto(inst, x.where, `join ${x.part.name} into ${enemy.id}`)) {
        if (x.where.savePoints.length) { say(`  🧱 ${x.part.name} joins the main copy.`); emit({ type: "save_point", hero: x.hero.id, sha: inst.savePoints.at(-1)!.slice(0, 8) }); }
      } else {
        clashes.push(x.part.id);
        say(`  💥 ${x.part.name} clashed with the parts before it and was set aside. Fight it again after you keep the rest.`);
      }
      await discard(cwd, x.where);
      siegeParts.set(x.hero.id, [...(siegeParts.get(x.hero.id) ?? []), x.part]);
    }
    party.splice(0, party.length, ...party.filter((c) => siegeParts.has(c.id))); // heroes without a part sit this one out
  }
  const fightDir = inst?.path ?? cwd;

  // The Council's watch over a Relay: after each turn, is the party getting somewhere?
  const watch = opts.council && opts.formation !== "pincer" && opts.formation !== "siege";
  const withChecks = enemy.criteria.filter((k) => k.check);
  const allByChecks = withChecks.length > 0 && withChecks.length === enemy.criteria.length;
  let passing = watch && withChecks.length ? (await runChecks(enemy, fightDir)).size : 0;
  let idleStreak = 0, turnNo = 0;
  const calls: Array<{ id: string; call: StuckCall }> = [];
  const acted = new Set<string>();

  for (const c of opts.formation === "pincer" || opts.formation === "siege" ? [] : party) {
    const perms = permissionsFor(c.tier);
    const goldLimit = Math.min(budgetGold - costGold, perms.maxGoldPerBattle);
    const broke = canAfford(world, c, Math.min(goldLimit, 0.01), c.mp ? 1 : 0);
    if (broke) { say(`  ${c.name}: ${broke}`); continue; }
    say(`  ${c.name} the ${title(c)} acts…`);
    emit({ type: "turn", hero: c.id });
    const before = store.violationCount(c.id);
    const r = await ADAPTERS[c.adapter].run({ character: c, prompt: buildPrompt(c, enemy, store), cwd: fightDir, permissions: perms, maxTurns, goldLimit, home: store.root, questId: enemy.id });
    let changed = false;
    acted.add(c.id);
    const blocked = store.violationCount(c.id) - before;
    if (blocked > 0 && !r.violation) r.violation = `was stopped by the Gatekeeper ${blocked} time(s)`;
    spend(world, c, r.costGold, r.costMp);
    costGold += r.costGold; costMp += r.costMp; turns += r.turns;
    store.writeScroll(enemy.id, `${c.name} (${title(c)})`, r.output || `(no output${r.error ? ": " + r.error : ""})`);
    if (inst) {
      const sp = await savePoint(inst, `${c.name} (${title(c)}) on ${enemy.id}`);
      if (sp) { changed = true; say(`  💾 Save point ${sp.slice(0, 8)}`); emit({ type: "save_point", hero: c.id, sha: sp.slice(0, 8) }); }
    }
    if (r.violation) { critical = `${c.name} ${r.violation}`; say(`  ⚠️  ${critical}`); break; }
    if (r.error) say(`  ✖ ${r.error}`);
    // Wait mode: if you handed this hero's job to someone else, they take the next turn.
    for (const a of new AskBook(store.chronicleDir).all()) {
      if (a.hero !== c.id || a.quest !== enemy.id || a.decision !== "handoff" || !a.to || a.at < startedAt) continue;
      const next = world.party.find((x) => x.id === a.to);
      if (next && !party.includes(next) && party.length < 4) {
        refillMp(next);
        party.push(next);
        say(`  🤝 ${c.name} hands the job to ${next.name}.`);
        store.writeScroll(enemy.id, "Guild Master", `${c.name} needed to ${NEED_WORDS[a.need]} (${a.target}). ${next.name} takes over; read ${c.name}'s notes above.`);
      }
    }

    if (!watch) continue;
    turnNo++;
    idleStreak = changed ? 0 : idleStreak + 1;
    const passBefore = passing;
    if (changed && withChecks.length) passing = (await runChecks(enemy, fightDir)).size;
    // Every condition is proven by a check and all pass: the rest of the party stands down.
    if (allByChecks && passing === withChecks.length) { if (party.indexOf(c) < party.length - 1) say("  ✅ Every check passes, so the rest of the party stands down."); break; }
    const need = QUEST_TYPES[questTypeOf(enemy)].needs;
    const top = Math.max(...party.map((x) => x.tier));
    const helper = party.length < 4 ? world.party
      .filter((x) => !party.includes(x) && x.tier > top && permissionsFor(x.tier)[need] && !canAfford(world, x, 0.01, x.mp ? 1 : 0))
      .sort((a2, b2) => reliability(recordFor(b2)) - reliability(recordFor(a2)))[0] : undefined;
    const isLast = party.indexOf(c) === party.length - 1;
    if (isLast && !helper) continue;
    const verdictCall = await stuckCall(world, store, opts.council!, enemy, fightDir, {
      turn: turnNo, changed, passingBefore: passBefore, passingAfter: passing, checks: withChecks.length, idleStreak,
      spentShare: budgetGold ? costGold / budgetGold : 1, error: r.error, helper, needsWrite: need !== "read",
    });
    const d = opts.council!.decisions().filter((x) => x.kind === "stuck" && x.questId === enemy.id).at(-1);
    if (d) calls.push({ id: d.id, call: verdictCall.call });
    if (verdictCall.call === "retreat") {
      say(`  🏳 The Council calls a retreat: ${verdictCall.why}.`);
      store.writeScroll(enemy.id, "The Council", `Retreat after turn ${turnNo}: ${verdictCall.why}.`);
      break;
    }
    if (verdictCall.call === "help" && helper) {
      refillMp(helper);
      party.splice(party.indexOf(c) + 1, 0, helper); // the helper takes the very next turn
      say(`  📯 The Council calls for help: ${verdictCall.why}. ${helper.name} the ${title(helper)} joins.`);
      store.writeScroll(enemy.id, "The Council", `${helper.name} joins after turn ${turnNo}: ${verdictCall.why}. Read the notes above.`);
    }
  }

  // Heroes who never got a turn (the party stood down or retreated early) share neither the reward nor the blame.
  if (watch && acted.size) party.splice(0, party.length, ...party.filter((c) => acted.has(c.id)));
  const verdict = await judgeBattle(opts, enemy, party, fightDir, inst);
  const judgeGold = verdict.costGold; // the referee's fee doesn't count against the party's budget

  if (!critical && enemy.guard) {
    const g = await runProcess("sh", ["-c", enemy.guard], { cwd: fightDir, timeoutMs: 15 * 60_000 });
    if (g.code !== 0) critical = "guard check failed (regression)";
  }
  if (!critical && costGold > budgetGold + 1e-9) critical = `overspent: ${costGold.toFixed(3)}G of ${budgetGold}G`;
  if (critical) { verdict.outcome = "critical"; verdict.notes = `${critical}. ${verdict.notes}`; }
  // Saying no is never held against the hero: a loss after you refused an ask is a retreat, not a defeat.
  const refused = new AskBook(store.chronicleDir).all().filter((a) => a.quest === enemy.id && a.at >= startedAt && (a.decision === "deny" || a.status === "expired"));
  if (!critical && verdict.outcome === "defeat" && refused.length) {
    verdict.outcome = "retreat";
    verdict.notes = `${verdict.notes} You said no to ${refused.length} request(s), so this counts as a retreat, not a loss.`.trim();
  }

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
    let t = trialFor(verdict.outcome, verdict.correctness);
    // In a Pincer, the approach that wasn't chosen isn't a failure: its hero gets XP but no change in trust.
    if (c === pincerLoser) { if (levels) say(`  ✨ ${c.name} reached Lv ${c.level}!`); continue; }
    // In a Siege, each hero answers for their own parts. A part set aside after a clash doesn't count either way.
    const mine = siegeParts.get(c.id);
    if (mine) {
      if (mine.some((p) => clashes.includes(p.id))) { if (levels) say(`  ✨ ${c.name} reached Lv ${c.level}!`); continue; }
      const ids = new Set(mine.flatMap((p) => p.criteria).filter((id) => !verdict.awaitingYou.includes(id)));
      if (ids.size && verdict.outcome !== "critical") {
        const own = [...ids].filter((id) => enemy.criteria.find((k) => k.id === id)?.met).length / ids.size;
        t = trialFor(own >= 1 ? "victory" : own > 0 ? "retreat" : "defeat", own);
      }
    }
    // Every member is accountable for the whole outcome, so trust counts the full trial.
    rec.successes += t.s;
    rec.failures += t.f;
    rec.battles += 1;
    if (levels) say(`  ✨ ${c.name} reached Lv ${c.level}!`);
    const change = settleTier(c);
    if (change === "promoted") { promotions.push(c.id); say(`  🎺 ${c.name} was promoted to ${title(c)} (Tier ${c.tier})!`); }
    if (change === "cursed") { curses.push(c.id); say(`  🩸 ${c.name} is cursed and falls to ${title(c)} (Tier ${c.tier}).`); }
  }

  emit({ type: "verdict", outcome: verdict.outcome, correctness: verdict.correctness, hp: hpLeft(), maxHp: enemy.criteria.length,
    judgedBy: verdict.judgedBy, awaitingYou: verdict.awaitingYou });
  // A victory still waiting for your confirmation stays open until you Keep it.
  enemy.status = verdict.outcome === "victory" && !verdict.awaitingYou.length ? "defeated" : "lurking";

  // Treasure Vault: changes wait for you. Unsafe work (a critical failure) is thrown away at once.
  let review: BattleReport["review"] = undefined;
  if (inst) {
    if (!inst.savePoints.length && verdict.awaitingYou.length) { await discard(cwd, inst); inst.savePoints = []; review = "pending"; say(`  📦 Treasure Vault: no files changed, but ${verdict.awaitingYou.length} condition(s) wait for you. Keep or undo: savepoint keep ${battleId} · savepoint undo ${battleId}`); }
    else if (!inst.savePoints.length) { await discard(cwd, inst); review = "nothing"; }
    else if (verdict.outcome === "critical") { await discard(cwd, inst); if (alternate) { await discard(cwd, alternate); } review = "undone"; say("  🗑 The party's changes were thrown away (critical failure). Your project is untouched."); }
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

  // Calls to carry on or bring help were right if the quest was won. (A retreat can't be checked: we never see what would have happened.)
  for (const x of calls) if (x.call !== "retreat" && verdict.outcome !== "retreat") opts.council!.markOutcome(x.id, verdict.outcome === "victory" ? "right" : "wrong", `battle ${battleId}`);

  if (opts.debrief && verdict.outcome !== "critical") {
    const lessons = await debrief(world, store, enemy, verdict.awaitingYou.length ? "waiting for the Guild Master to check" : `${verdict.outcome} (${verdict.notes})`, party.map((c) => c.id), cwd);
    for (const l of lessons) say(`  📖 Lesson: ${l}`);
  }

  const report: BattleReport = {
    id: battleId, enemyId: enemy.id, questType: questTypeOf(enemy), instance: inst, review, alternate, formation: opts.formation,
    clashes: clashes.length ? clashes : undefined,
    newlyMet: enemy.criteria.filter((k) => k.met && !metBefore.has(k.id)).map((k) => k.id),
    awaitingYou: verdict.awaitingYou.length ? verdict.awaitingYou : undefined,
    party: party.map((c) => ({ characterId: c.id, share })),
    costGold: +(costGold + judgeGold).toFixed(4), costMp, turns, verdict, xpAwarded, promotions, curses,
    at: new Date().toISOString(),
  };
  world.battles.push(report);
  emit({ type: "battle_end", outcome: verdict.outcome, review, xp: xpAwarded, promotions, curses });
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
export async function keepBattle(world: World, store: Store, battleId: string, cwd: string, other = false): Promise<string> {
  const b = pendingBattle(world, battleId);
  if (other) {
    if (!b.alternate) throw new Error("This battle has no other approach to keep.");
    if (b.instance) await discard(cwd, b.instance);
    b.instance = b.alternate;
  } else if (b.alternate) await discard(cwd, b.alternate);
  b.alternate = undefined;
  const msg = b.instance?.savePoints.length ? await keep(cwd, b.instance) : "Confirmed.";
  b.review = "kept";
  store.event({ type: "review", battle: battleId, decision: "kept" });
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
export async function undoBattle(world: World, store: Store, battleId: string, cwd: string, council?: Council, why?: string): Promise<string> {
  const b = pendingBattle(world, battleId);
  if (b.instance?.savePoints.length) await discard(cwd, b.instance);
  if (b.alternate) { await discard(cwd, b.alternate); b.alternate = undefined; }
  b.review = "undone";
  store.event({ type: "review", battle: battleId, decision: "undone" });
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
  store.log({ type: "review", battle: battleId, decision: "undone", why });
  // Your reason becomes a house rule every hero reads from now on.
  if (why?.trim()) store.addLore(`House rule: ${why.replace(/\s+/g, " ").trim().slice(0, 300)} (from you, after undoing ${b.enemyId})`);
  return b.instance?.savePoints.length
    ? "Undone: the changes were thrown away and the quest is open again. It counts as a loss for the party."
    : "Rejected: the quest is open again, and it counts as a loss for the party.";
}
