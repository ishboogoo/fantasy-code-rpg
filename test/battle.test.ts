import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/store.ts";
import { battle } from "../src/battle.ts";
import type { Character, World } from "../src/types.ts";

function mockChar(id: string, job: Character["job"], skill: string): Character {
  return { id, name: id, adapter: "mock", job, tier: 0, level: 1, xp: 0, totalXp: 0, records: {}, status: [],
    recruitedAt: "", adapterConfig: { skill, seed: "test" } };
}

function setup(): { world: World; store: Store; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), "sp-test-"));
  const store = new Store(dir);
  store.init();
  const world = store.load();
  world.treasury.gold = 10;
  world.party.push(mockChar("hero", "fighter", "1"), mockChar("judge", "cleric", "1"));
  return { world, store, dir };
}

test("a perfect fighter defeats an enemy judged by a cleric", async () => {
  const { world, store, dir } = setup();
  world.enemies.push({ id: "g1", name: "Goblin", kind: "goblin", level: 2, description: "", status: "lurking",
    criteria: [{ id: "a", description: "x", met: false }], budget: { gold: 1, maxTurns: 5 } });
  const r = await battle({ world, store, enemyId: "g1", partyIds: ["hero"], judge: { kind: "character", id: "judge" }, cwd: dir });
  assert.ok(["victory", "critical"].includes(r.verdict.outcome));
  if (r.verdict.outcome === "victory") {
    assert.ok(r.xpAwarded.hero > 0);
    assert.match(store.scroll("g1"), /DONE: a/, "the fighter's notes land in the shared scroll");
  }
});

test("a character cannot judge its own battle", async () => {
  const { world, store, dir } = setup();
  world.enemies.push({ id: "g2", name: "Goblin", kind: "goblin", level: 1, description: "", status: "lurking",
    criteria: [{ id: "a", description: "x", met: false }], budget: { gold: 1 } });
  await assert.rejects(
    battle({ world, store, enemyId: "g2", partyIds: ["hero"], judge: { kind: "character", id: "hero" }, cwd: dir }),
    /Anti-cheat/,
  );
});

test("test-based checks decide correctness without any judge", async () => {
  const { world, store, dir } = setup();
  world.enemies.push({ id: "s1", name: "Slime", kind: "slime", level: 1, description: "", status: "lurking",
    criteria: [{ id: "ok", description: "passes", check: "true", met: false }, { id: "no", description: "fails", check: "false", met: false }],
    budget: { gold: 1 } });
  const r = await battle({ world, store, enemyId: "s1", partyIds: ["hero"], judge: { kind: "tests" }, cwd: dir });
  if (r.verdict.outcome !== "critical") {
    assert.equal(r.verdict.outcome, "retreat");
    assert.equal(r.verdict.correctness, 0.5);
  }
});

test("a failing guard turns the battle into a critical failure", async () => {
  const { world, store, dir } = setup();
  world.enemies.push({ id: "s2", name: "Slime", kind: "slime", level: 1, description: "", status: "lurking",
    criteria: [{ id: "ok", description: "passes", check: "true", met: false }], guard: "false", budget: { gold: 1 } });
  const r = await battle({ world, store, enemyId: "s2", partyIds: ["hero"], judge: { kind: "tests" }, cwd: dir });
  assert.equal(r.verdict.outcome, "critical");
  assert.equal(r.xpAwarded.hero, 0);
});
