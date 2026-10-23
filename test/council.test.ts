import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Council, probabilityBest, seeded, betaSample } from "../src/council.ts";
import { classifyByRules } from "../src/quests.ts";
import { recommendParty } from "../src/party.ts";
import type { BattleReport, Character, Enemy, World } from "../src/types.ts";

const council = () => new Council(mkdtempSync(join(tmpdir(), "council-")));

test("the first seat that is sure enough answers, and the decision is written down", () => {
  const c = council();
  const d = c.decide<string>("quest-type", "What kind?", {
    law: () => ({ answer: "fix", confidence: 0.9, reasons: ["mentions bug"] }),
    ledger: () => { throw new Error("should not be asked"); },
  }, "q1");
  assert.equal(d.seat, "law");
  assert.equal(d.answer, "fix");
  assert.equal(c.decisions().length, 1);
});

test("when nobody is sure, the decision goes to you with the best guess as a suggestion", () => {
  const c = council();
  const d = c.decide<string>("party-lead", "Who leads?", {
    law: () => ({ answer: "aria", confidence: 0.5, reasons: ["rule of thumb"] }),
    ledger: () => ({ answer: "mira", confidence: 0.6, reasons: ["slightly better record"] }),
  });
  assert.equal(d.seat, "you");
  assert.equal(d.answer, null);
  assert.equal(d.suggestion, "mira");
});

test("outcomes feed each seat's accuracy", () => {
  const c = council();
  const a = c.decide<string>("quest-type", "?", { law: () => ({ answer: "fix", confidence: 0.9, reasons: [] }) });
  const b = c.decide<string>("quest-type", "?", { law: () => ({ answer: "build", confidence: 0.9, reasons: [] }) });
  c.markOutcome(a.id, "right");
  c.markOutcome(b.id, "wrong");
  c.markOutcome(b.id, "right"); // the latest mark wins
  const row = c.accuracy().find((r) => r.seat === "law")!;
  assert.deepEqual([row.decided, row.judged, row.right], [2, 2, 2]);
});

test("Beta samples stay in range and the Ledger favours the proven hero", () => {
  const r = seeded(3);
  for (let i = 0; i < 200; i++) { const v = betaSample(2, 5, r); assert.ok(v > 0 && v < 1); }
  const p = probabilityBest(new Map([["proven", { successes: 18, failures: 2 }], ["new", { successes: 1, failures: 1 }]]));
  assert.ok(p.get("proven")! > 0.75, `proven should usually be best, got ${p.get("proven")}`);
  const even = probabilityBest(new Map([["a", { successes: 0, failures: 0 }], ["b", { successes: 0, failures: 0 }]]));
  assert.ok(even.get("a")! < 0.7, "no data means no confidence");
});

test("the Law classifies only when exactly one kind of work is mentioned", () => {
  assert.equal(classifyByRules("Checkout crashes for some users")?.type, "fix");
  assert.equal(classifyByRules("Update the setup guide in the README")?.type, "write");
  assert.equal(classifyByRules("Which payment provider should we use?")?.type, "explore");
  assert.equal(classifyByRules("Fix the bug and add a new feature"), null, "two kinds at once: the Law abstains");
  assert.equal(classifyByRules("Make it nicer"), null);
});

const hero = (id: string, tier: Character["tier"], adapter: Character["adapter"]): Character => ({
  id, name: id, adapter, job: "fighter", tier, level: 5, xp: 0, totalXp: 0, status: [], recruitedAt: "", records: {},
});

test("the Ledger picks the hero with the winning record on this quest type", () => {
  const enemy: Enemy = { id: "e9", name: "Login Goblin", kind: "goblin", questType: "fix", level: 2, description: "", criteria: [], budget: {}, status: "lurking" };
  const won = (who: string, i: number, outcome: "victory" | "defeat"): BattleReport => ({
    id: `b${who}${i}`, enemyId: "old", questType: "fix", party: [{ characterId: who, share: 1 }], costGold: 0, costMp: 0, turns: 1,
    verdict: { outcome, correctness: outcome === "victory" ? 1 : 0, quality: 1, notes: "", judgedBy: "tests" },
    xpAwarded: {}, promotions: [], curses: [], at: "",
  });
  const battles = [
    ...Array.from({ length: 12 }, (_, i) => won("aria", i, "victory")),
    ...Array.from({ length: 12 }, (_, i) => won("bram", i, i < 3 ? "victory" : "defeat")),
  ];
  const world: World = { version: 1, party: [hero("bram", 2, "codex"), hero("aria", 2, "claude-code")], enemies: [enemy], treasury: { gold: 10, spent: 0 }, battles };
  const plan = recommendParty(world, enemy, 2, council());
  assert.equal(plan.leadDecision?.seat, "ledger");
  assert.equal(plan.members[0].id, "aria");
});

test("with only one hero trusted to change files, the Law decides the lead", () => {
  const enemy: Enemy = { id: "e8", name: "Typo", kind: "slime", questType: "fix", level: 1, description: "", criteria: [], budget: {}, status: "lurking" };
  const world: World = { version: 1, party: [hero("novice", 0, "codex"), hero("aria", 1, "claude-code")], enemies: [enemy], treasury: { gold: 10, spent: 0 }, battles: [] };
  const plan = recommendParty(world, enemy, 2, council());
  assert.equal(plan.leadDecision?.seat, "law");
  assert.equal(plan.members[0].id, "aria");
});
