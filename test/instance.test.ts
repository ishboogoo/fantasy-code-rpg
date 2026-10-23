import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { Store } from "../src/store.ts";
import { battle, keepBattle, undoBattle } from "../src/battle.ts";
import { Council } from "../src/council.ts";
import type { Character, Enemy } from "../src/types.ts";

process.env.SAVEPOINT_INSTANCES = mkdtempSync(join(tmpdir(), "sp-instances-"));

function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), "sp-repo-"));
  const git = (...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: dir });
  git("init", "-q", "-b", "main");
  writeFileSync(join(dir, "README.md"), "hello\n");
  git("add", "-A");
  git("commit", "-q", "-m", "init");
  return dir;
}

function setup(command: string) {
  const dir = repo();
  const store = new Store(dir);
  store.init();
  const world = store.load();
  world.treasury.gold = 10;
  const smith: Character = { id: "smith", name: "Smith", adapter: "shell", job: "fighter", tier: 2, level: 8, xp: 0, totalXp: 0,
    records: {}, status: [], recruitedAt: "", adapterConfig: { command } };
  world.party.push(smith);
  const quest: Enemy = { id: "q1", name: "Missing file", kind: "slime", questType: "fix", level: 1, description: "", status: "lurking",
    criteria: [{ id: "file", description: "out.txt exists", check: "test -f out.txt", met: false }], budget: { gold: 1 } };
  world.enemies.push(quest);
  return { dir, store, world, council: new Council(store.chronicleDir) };
}

test("a battle works in its own copy; your folder is untouched until you keep it", async () => {
  const { dir, store, world, council } = setup("echo done > out.txt");
  const r = await battle({ world, store, enemyId: "q1", partyIds: ["smith"], judge: { kind: "tests" }, cwd: dir, council });
  assert.equal(r.verdict.outcome, "victory");
  assert.equal(r.review, "pending");
  assert.equal(r.instance?.savePoints.length, 1, "one save point after the hero's turn");
  assert.ok(!existsSync(join(dir, "out.txt")), "nothing lands in your folder before you keep it");
  await keepBattle(world, store, r.id, dir);
  assert.ok(existsSync(join(dir, "out.txt")), "keep brings the change in");
  assert.equal(r.review, "kept");
});

test("undo throws the work away, reopens the quest and counts as a loss", async () => {
  const { dir, store, world, council } = setup("echo done > out.txt");
  const r = await battle({ world, store, enemyId: "q1", partyIds: ["smith"], judge: { kind: "tests" }, cwd: dir, council });
  const smith = world.party[0];
  const before = { ...smith.records.fighter! };
  await undoBattle(world, store, r.id, dir, council);
  assert.ok(!existsSync(join(dir, "out.txt")));
  assert.equal(world.enemies[0].status, "lurking");
  assert.equal(world.enemies[0].criteria[0].met, false);
  assert.equal(smith.records.fighter!.successes, before.successes - 1);
  assert.equal(smith.records.fighter!.failures, before.failures + 1);
});

test("a battle that changes nothing leaves nothing to review", async () => {
  const { dir, store, world } = setup("true");
  const r = await battle({ world, store, enemyId: "q1", partyIds: ["smith"], judge: { kind: "tests" }, cwd: dir });
  assert.equal(r.review, "nothing");
  assert.equal(r.verdict.outcome, "defeat");
});
