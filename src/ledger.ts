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
  return out;
}
