import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { Store } from "../src/store.ts";
import { battle, keepBattle, siegeBrief } from "../src/battle.ts";
import { parsePart } from "../src/stages.ts";
import type { Character, Enemy } from "../src/types.ts";

process.env.SAVEPOINT_INSTANCES = mkdtempSync(join(tmpdir(), "sp-si-"));

function setup(cmdA: string, cmdB: string) {
  const dir = mkdtempSync(join(tmpdir(), "sp-siege-"));
  const git = (...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: dir });
  git("init", "-q", "-b", "main"); writeFileSync(join(dir, "README.md"), "x\n"); git("add", "-A"); git("commit", "-q", "-m", "init");
  const store = new Store(dir); store.init();
  const w = store.load(); w.treasury.gold = 10;
  const smith = (id: string, cmd: string): Character => ({ id, name: id[0].toUpperCase() + id.slice(1), adapter: "shell", job: "fighter", tier: 2,
    level: 8, xp: 0, totalXp: 0, records: {}, status: [], recruitedAt: "", adapterConfig: { command: cmd } });
  w.party.push(smith("anna", cmdA), smith("bo", cmdB));
  const q: Enemy = { id: "q1", name: "Two pages", kind: "golem", questType: "build", level: 2, description: "", status: "lurking", budget: { gold: 2 },
    criteria: [{ id: "a", description: "a.txt exists", check: "test -f a.txt", met: false }, { id: "b", description: "b.txt exists", check: "test -f b.txt", met: false }] };
  q.parts = [parsePart("Page A [a]", q, 0), parsePart("Page B: b", q, 1)];
  w.enemies.push(q);
  return { dir, store, w, q };
}

test("parts are read from plain text", () => {
  const { q } = setup("true", "true");
  assert.deepEqual(q.parts, [{ id: "p1", name: "Page A", criteria: ["a"] }, { id: "p2", name: "Page B", criteria: ["b"] }]);
  assert.deepEqual(parsePart("Docs: update the guide", q, 2).criteria, [], "a colon in a name isn't mistaken for condition ids");
  assert.match(siegeBrief(q, q.parts![0], [{ part: q.parts![1], hero: { name: "Bo" } as Character }]), /Your part: Page A[\s\S]*\[a\][\s\S]*Page B \(Bo\)/);
});

test("Siege: every part is fought at once and joined into one result", async () => {
  const { dir, store, w } = setup("echo a > a.txt", "echo b > b.txt");
  const r = await battle({ world: w, store, enemyId: "q1", partyIds: ["anna", "bo"], judge: { kind: "tests" }, cwd: dir, formation: "siege" });
  assert.equal(r.verdict.outcome, "victory");
  assert.equal(r.clashes, undefined);
  assert.equal(w.party.find((c) => c.id === "bo")!.records.fighter?.successes, 1, "each hero is credited for their own part");
  await keepBattle(w, store, r.id, dir);
  assert.ok(existsSync(join(dir, "a.txt")) && existsSync(join(dir, "b.txt")));
});

test("Siege: a part that clashes is set aside, and only its hero's trust is left alone", async () => {
  const { dir, store, w } = setup("echo a > a.txt && echo one > README.md", "echo b > b.txt && echo two > README.md");
  const r = await battle({ world: w, store, enemyId: "q1", partyIds: ["anna", "bo"], judge: { kind: "tests" }, cwd: dir, formation: "siege" });
  assert.deepEqual(r.clashes, ["p2"]);
  assert.equal(r.verdict.outcome, "retreat", "half the quest is done");
  assert.equal(w.party.find((c) => c.id === "anna")!.records.fighter?.successes, 1, "Anna's part is fully done");
  assert.equal(w.party.find((c) => c.id === "bo")!.records.fighter?.battles ?? 0, 0, "a clash isn't counted against Bo");
  await keepBattle(w, store, r.id, dir);
  assert.ok(existsSync(join(dir, "a.txt")) && !existsSync(join(dir, "b.txt")));
});

test("Siege needs parts", async () => {
  const { dir, store, w, q } = setup("true", "true");
  delete q.parts;
  await assert.rejects(battle({ world: w, store, enemyId: "q1", partyIds: ["anna"], judge: { kind: "tests" }, cwd: dir, formation: "siege" }), /split/);
});
