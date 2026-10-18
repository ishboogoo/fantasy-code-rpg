import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canPromote, gainXp, performance, permissionsFor, reliability, settleTier, trialFor, xpAward, xpToNext,
} from "../src/rules.ts";
import type { Character, Enemy } from "../src/types.ts";

function char(over: Partial<Character> = {}): Character {
  return { id: "t", name: "T", adapter: "mock", job: "fighter", tier: 0, level: 1, xp: 0, totalXp: 0,
    records: {}, status: [], recruitedAt: "", ...over };
}
const orc: Enemy = { id: "o", name: "Orc", kind: "orc", level: 4, description: "", status: "lurking",
  criteria: [{ id: "a", description: "", met: false }, { id: "b", description: "", met: false }], budget: { gold: 1 } };

test("level curve grows superlinearly", () => {
  assert.equal(xpToNext(1), 50);
  assert.ok(xpToNext(10) > 10 * xpToNext(1));
});

test("gainXp rolls over multiple levels", () => {
  const c = char();
  assert.equal(gainXp(c, 50 + xpToNext(2) + 1), 2);
  assert.equal(c.level, 3);
  assert.equal(c.xp, 1);
});

test("reliability rewards track record, not luck", () => {
  const lucky = reliability({ successes: 3, failures: 0, battles: 3 });
  const proven = reliability({ successes: 58, failures: 2, battles: 60 });
  assert.ok(proven > lucky, `${proven} should beat ${lucky}`);
  assert.equal(reliability(undefined), 0);
});

test("critical failure costs three trials", () => {
  assert.deepEqual(trialFor("critical", 1), { s: 0, f: 3 });
  assert.deepEqual(trialFor("retreat", 0.5), { s: 0.5, f: 0.5 });
});

test("type advantage boosts XP and critical gives none", () => {
  const perf = 1;
  assert.ok(xpAward(orc, "fighter", perf, 1, "victory") > xpAward(orc, "bard", perf, 1, "victory"));
  assert.equal(xpAward(orc, "fighter", perf, 1, "critical"), 0);
  assert.equal(xpAward(orc, "fighter", perf, 1, "defeat"), 0, "a fast, cheap defeat earns nothing");
});

test("performance rewards coming in under budget", () => {
  const verdict = { outcome: "victory" as const, correctness: 1, quality: 1, notes: "", judgedBy: "tests" };
  const cheap = performance({ verdict, cost: 0.1, budget: 1, turns: 1, maxTurns: 10 });
  const pricey = performance({ verdict, cost: 0.9, budget: 1, turns: 1, maxTurns: 10 });
  assert.ok(cheap > pricey);
});

test("promotion needs level AND reliability AND battles", () => {
  const c = char({ level: 3, records: { fighter: { successes: 4, failures: 0, battles: 4 } } });
  assert.equal(canPromote(c), false, "4 battles is not enough");
  c.records.fighter = { successes: 12, failures: 0, battles: 12 };
  assert.equal(canPromote(c), true);
  assert.equal(settleTier(c), "promoted");
  assert.equal(c.tier, 1);
});

test("unreliable characters get cursed and lose permissions", () => {
  const c = char({ tier: 2, level: 10, records: { fighter: { successes: 10, failures: 15, battles: 25 } } });
  assert.equal(permissionsFor(c.tier).exec, true);
  assert.equal(settleTier(c), "cursed");
  assert.equal(c.tier, 1);
  assert.equal(permissionsFor(c.tier).exec, false);
  assert.ok(c.status.includes("cursed"));
});

test("tier ladder unlocks permissions in order", () => {
  const order = ["write", "exec", "network", "merge"] as const;
  order.forEach((perm, i) => {
    assert.equal(permissionsFor(i as 0)[perm], false, `${perm} locked at T${i}`);
    assert.equal(permissionsFor((i + 1) as 1)[perm], true, `${perm} unlocked at T${i + 1}`);
  });
});
