// Party recommendation: for each quest, suggest who should fight, who should back them up,
// and who should judge, then let the player swap anyone and explain the trade-offs in plain words.
import type { AdapterKind, Character, Enemy, JobLine, Permissions, Tier, World } from "./types.ts";
import { JOB_TITLES, WEAKNESS, permissionsFor, recordFor, reliability, title } from "./rules.ts";
import { ADAPTERS } from "./adapters/index.ts";
import { QUEST_TYPES, questTypeOf } from "./quests.ts";
import { probabilityBest, type Council, type Decision, type SeatAnswer } from "./council.ts";
import { ledgerRecords } from "./ledger.ts";

export type Role = "lead" | "support" | "judge";
export interface Pick { id: string; name: string; role: Role; score: number; reasons: string[] }
export interface PartyPlan {
  members: Pick[];
  warnings: string[];
  estimate: { goldCap: number; usesMp: boolean };
  /** How the lead was chosen, when a Council was consulted. */
  leadDecision?: Decision<string>;
}

const API: AdapterKind[] = ["anthropic-api", "openai-compatible"];
const need = (e: Enemy): keyof Permissions => e.needs ?? QUEST_TYPES[questTypeOf(e)].needs;
/** Which AI company is behind an adapter, so judges can come from a different one. */
export const vendor = (a: AdapterKind): string =>
  a === "claude-code" || a === "anthropic-api" ? "anthropic" : a === "codex" || a === "openai-compatible" ? "openai" : a === "gemini-cli" ? "google" : a;

function available(c: Character): boolean {
  if (c.status.includes("resting")) return false;
  if (c.mp && c.mp.current <= 0) return false;
  return c.tier >= (ADAPTERS[c.adapter]?.minTier ?? 0);
}

/** How well one character fits one quest in one role. Higher is better; reasons are shown to the player. */
export function fit(c: Character, e: Enemy, role: Role, world?: World): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const rel = reliability(recordFor(c));
  score += rel * 4;
  if (rel >= 0.7) reasons.push(`Reliable: wins most quests (${Math.round(rel * 100)}% trust)`);
  if (WEAKNESS[e.kind].includes(c.job) && WEAKNESS[e.kind].length < 5) { score += 2; reasons.push(`${JOB_TITLES[c.job][0]}s are strong against this kind of monster`); }
  const perms = permissionsFor(c.tier);
  if (role === "lead" && QUEST_TYPES[questTypeOf(e)].leads.includes(c.job)) {
    score += 1.5;
    reasons.push(`${JOB_TITLES[c.job][0]}s are a natural fit to lead ${QUEST_TYPES[questTypeOf(e)].label} quests`);
  }
  if (role === "lead") {
    if (perms[need(e)]) { score += 3; } else { score -= 10; reasons.push(`Not yet trusted to ${need(e) === "exec" ? "run commands" : "change files"}`); }
    if (perms.maxGoldPerBattle >= (e.budget.gold ?? 0)) score += 0.5;
  }
  if (role === "judge") {
    if (c.job === "cleric") { score += 2; reasons.push("Clerics are trained to check work"); }
    if (c.tier === 0) { score -= 3; reasons.push("Still a Novice: their second opinion counts for less"); }
    if (c.adapter === "shell" || c.adapter === "mock") score -= 5;
  }
  if (c.status.includes("cursed")) { score -= 3; reasons.push("Recently demoted: recovering trust"); }
  if (c.mp) { score += 0.5; reasons.push("Uses a subscription, so it costs no gold"); }
  else if (API.includes(c.adapter) && world) {
    const left = world.treasury.gold - world.treasury.spent;
    if (left < (e.budget.gold ?? 1)) { score -= 2; reasons.push("Pay-per-use and the treasury is low"); }
  }
  return { score, reasons };
}

/** Recommend a party: one lead who can do the job, supports who cover weaknesses, and a judge from a different AI company. */
export function recommendParty(world: World, e: Enemy, size = 3, council?: Council): PartyPlan {
  const pool = world.party.filter(available);
  const taken = new Set<string>();
  const members: Pick[] = [];
  let leadDecision: Decision<string> | undefined;
  if (council) {
    leadDecision = chooseLead(world, e, pool, council);
    const id = leadDecision.answer ?? leadDecision.suggestion;
    const c = id ? pool.find((x) => x.id === id) : undefined;
    if (c) {
      taken.add(c.id);
      const f = fit(c, e, "lead", world);
      const why = leadDecision.seat === "you" ? "Suggested; the Council isn't sure yet, so please confirm" : `Chosen by the ${leadDecision.seat === "law" ? "Law" : "Ledger"}`;
      members.push({ id: c.id, name: c.name, role: "lead", score: f.score, reasons: [why, ...leadDecision.reasons.slice(0, 1), ...f.reasons] });
    }
  }
  const take = (role: Role, filter: (c: Character) => boolean = () => true) => {
    const ranked = pool.filter((c) => !taken.has(c.id) && filter(c))
      .map((c) => ({ c, ...fit(c, e, role, world) })).sort((a, b) => b.score - a.score);
    const best = ranked[0];
    if (!best) return null;
    taken.add(best.c.id);
    const p: Pick = { id: best.c.id, name: best.c.name, role, score: best.score, reasons: best.reasons };
    members.push(p);
    return best.c;
  };
  const lead = members.length ? pool.find((c) => c.id === members[0].id)! : take("lead");
  // Judge: prefer someone powered by a different company, so the second opinion is truly independent.
  const judge = lead ? take("judge", (c) => vendor(c.adapter) !== vendor(lead.adapter)) ?? take("judge") : null;
  while (members.length < size && take("support")) { /* fill */ }
  // keep display order: lead, supports, judge
  members.sort((a, b) => ["lead", "support", "judge"].indexOf(a.role) - ["lead", "support", "judge"].indexOf(b.role));
  void judge;
  return { members, warnings: checkParty(world, e, members.map((m) => ({ id: m.id, role: m.role }))), estimate: estimate(world, members), leadDecision };
}

function estimate(world: World, members: Array<{ id: string }>) {
  const cs = members.map((m) => world.party.find((c) => c.id === m.id)!).filter(Boolean);
  return { goldCap: Math.max(0, ...cs.map((c) => permissionsFor(c.tier).maxGoldPerBattle)), usesMp: cs.some((c) => !!c.mp) };
}

/** Plain-language warnings for any party, recommended or hand-picked. Empty means good to go. */
export function checkParty(world: World, e: Enemy, picks: Array<{ id: string; role: Role }>): string[] {
  const w: string[] = [];
  const get = (id: string) => world.party.find((c) => c.id === id || c.name.toLowerCase() === id.toLowerCase());
  const lead = picks.find((p) => p.role === "lead");
  const judge = picks.find((p) => p.role === "judge");
  if (!lead) w.push("Nobody is leading. Pick one hero to do the main work.");
  for (const p of picks) {
    const c = get(p.id);
    if (!c) { w.push(`Nobody called ${p.id} is in your guild.`); continue; }
    if (!available(c)) w.push(`${c.name} can't fight right now (resting, out of MP, or not trusted with this tool yet).`);
  }
  const lc = lead && get(lead.id);
  if (lc && !permissionsFor(lc.tier)[need(e)]) w.push(permissionsFor(Math.min(4, lc.tier + 1) as Tier)[need(e)]
    ? `${lc.name} isn't trusted to ${need(e) === "exec" ? "run commands" : "change files"} yet, so they'll stop and ask you each time.`
    : `${lc.name} isn't trusted to ${need(e) === "exec" ? "run commands" : "change files"} yet, so they can only look and suggest. Pick a higher rank to lead.`);
  const jc = judge && get(judge.id);
  if (!jc) w.push("No judge: the result will be checked only by tests you wrote, or by you.");
  else if (lc && vendor(jc.adapter) === vendor(lc.adapter)) w.push(`${jc.name} and ${lc.name} come from the same AI company. A judge from a different one catches more mistakes.`);
  if (lc && WEAKNESS[e.kind].length && WEAKNESS[e.kind].length < 5 && !picks.some((p) => { const c = get(p.id); return c && WEAKNESS[e.kind].includes(c.job); }))
    w.push(`No one here is strong against this monster. Try a ${WEAKNESS[e.kind].join(" or ")}.`);
  return w;
}

/**
 * The lead is a Council decision. The Law answers when only one hero is trusted to do what the
 * quest needs. The Ledger answers when one hero's win record on this quest type is clearly best.
 * Otherwise it goes to you, with the rule-based pick as the suggestion.
 */
export function chooseLead(world: World, e: Enemy, pool: Character[], council: Council): Decision<string> {
  const qt = questTypeOf(e);
  const eligible = pool.filter((c) => permissionsFor(c.tier)[need(e)]);
  const law = (): SeatAnswer<string> | null => {
    if (!eligible.length) return null;
    if (eligible.length === 1) {
      return { answer: eligible[0].id, confidence: 1, reasons: [`Only ${eligible[0].name} is trusted to ${need(e) === "exec" ? "run commands" : need(e) === "write" ? "change files" : "do this"}`] };
    }
    // Several are eligible: the rules can rank them (trust, strengths, cost) but can't be sure.
    const top = eligible.map((c) => ({ c, ...fit(c, e, "lead", world) })).sort((a, b) => b.score - a.score)[0];
    return { answer: top.c.id, confidence: 0.5, reasons: [`Rule of thumb: ${top.c.name} fits best on trust, strengths and cost`] };
  };
  const ledger = (): SeatAnswer<string> | null => {
    if (eligible.length < 2) return null;
    const all = ledgerRecords(world, qt);
    const recs = new Map(eligible.map((c) => [c.id, all.get(c.id) ?? { successes: 0, failures: 0 }]));
    const p = probabilityBest(recs);
    const [id, conf] = [...p.entries()].sort((a, b) => b[1] - a[1])[0];
    const r = recs.get(id)!;
    const name = eligible.find((c) => c.id === id)!.name;
    return { answer: id, confidence: conf,
      reasons: [`${name} has won ${+r.successes.toFixed(1)} of ${+(r.successes + r.failures).toFixed(1)} ${QUEST_TYPES[qt].label} quests; ${Math.round(conf * 100)}% likely the best pick`] };
  };
  return council.decide<string>("party-lead", `Who should lead ${e.name}?`, { law, ledger }, e.id);
}
