// The Ledger: win records per (quest type × hero), read straight from past battle
// reports. It is the Council's second seat: free, instant, and it gets sharper
// with every Debrief.

import type { QuestType, World } from "./types.ts";
import { trialFor } from "./rules.ts";
import { questTypeOf } from "./quests.ts";
import type { Record2 } from "./council.ts";

/** Each hero's record on one quest type. A battle you undid at the Treasure Vault counts as a loss. */
export function ledgerRecords(world: World, questType: QuestType): Map<string, Record2> {
  const out = new Map<string, Record2>();
  for (const b of world.battles) {
    const enemy = world.enemies.find((e) => e.id === b.enemyId);
    const t = b.questType ?? (enemy ? questTypeOf(enemy) : undefined);
    if (t !== questType) continue;
    const trial = b.review === "undone" ? { s: 0, f: 1 } : trialFor(b.verdict.outcome, b.verdict.correctness);
    for (const m of b.party) {
      const r = out.get(m.characterId) ?? { successes: 0, failures: 0 };
      r.successes += trial.s;
      r.failures += trial.f;
      out.set(m.characterId, r);
    }
  }
  // Your preferences count a little: each time you picked someone else as lead, the hero you chose gains half a
  // win and the one you passed over a quarter of a loss, capped so results always outweigh preferences.
  const bonus = new Map<string, { s: number; f: number }>();
  for (const c of world.choices ?? []) {
    if (c.questType !== questType) continue;
    const a = bonus.get(c.chosen) ?? { s: 0, f: 0 }; a.s = Math.min(PREFERENCE_CAP, a.s + 0.5); bonus.set(c.chosen, a);
    const b = bonus.get(c.over) ?? { s: 0, f: 0 }; b.f = Math.min(PREFERENCE_CAP, b.f + 0.25); bonus.set(c.over, b);
  }
  for (const [id, b] of bonus) {
    const r = out.get(id) ?? { successes: 0, failures: 0 };
    r.successes += b.s; r.failures += b.f; out.set(id, r);
  }
  return out;
}

export const PREFERENCE_CAP = 3;

/** Remember that you chose a different lead than the Council suggested for this kind of quest. */
export function recordChoice(world: World, questType: QuestType, chosen: string, over: string): void {
  if (!chosen || !over || chosen === over) return;
  (world.choices ??= []).push({ questType, chosen, over, at: new Date().toISOString() });
  if (world.choices.length > 200) world.choices.splice(0, world.choices.length - 200);
}

/** The lead the Council last offered for a quest (its answer, or its suggestion when it went to you). */
export function lastLeadSuggestion(decisions: Array<{ kind: string; questId?: string; answer: unknown; suggestion?: unknown }>, questId: string): string | undefined {
  const d = decisions.filter((x) => x.kind === "party-lead" && x.questId === questId).at(-1);
  const v = d ? (d.answer ?? d.suggestion) : undefined;
  return typeof v === "string" ? v : undefined;
}
