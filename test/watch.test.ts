import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { Store } from "../src/store.ts";
import { Council } from "../src/council.ts";
import { battle } from "../src/battle.ts";
import { assessRisk, riskWords } from "../src/stages.ts";
import type { Character, Enemy, Tier } from "../src/types.ts";

process.env.SAVEPOINT_INSTANCES = mkdtempSync(join(tmpdir(), "sp-wa-"));

function setup(heroes: Array<[string, string, Tier?]>) {
  const dir = mkdtempSync(join(tmpdir(), "sp-watch-"));
  const git = (...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: dir });
  git("init", "-q", "-b", "main"); writeFileSync(join(dir, "README.md"), "x\n"); git("add", "-A"); git("commit", "-q", "-m", "init");
  const store = new Store(dir); store.init();
  const w = store.load(); w.treasury.gold = 10;
  for (const [id, cmd, tier] of heroes) w.party.push({ id, name: id[0].toUpperCase() + id.slice(1), adapter: "shell", job: "fighter", tier: tier ?? 2,
    level: 8, xp: 0, totalXp: 0, records: {}, status: [], recruitedAt: "", adapterConfig: { command: cmd } } as Character);
  const q: Enemy = { id: "q1", name: "Add a greeting", kind: "slime", questType: "build", level: 1, description: "", status: "lurking", budget: { gold: 2 },
    criteria: [{ id: "file", description: "hello.txt exists", check: "test -f hello.txt", met: false }] };
  w.enemies.push(q);
  return { dir, store, w, q, council: new Council(store.chronicleDir) };
}
const seer = (w: ReturnType<typeof setup>["w"]) => {
  w.party.push({ id: "sy", name: "Sy", adapter: "mock", job: "mage", tier: 1, level: 1, xp: 0, totalXp: 0, records: {}, status: [], recruitedAt: "", adapterConfig: { skill: "1" } } as Character);
  w.settings = { ...(w.settings ?? {}), seer: "sy" } as typeof w.settings;
};

test("risk: costly words, a past defeat, or an unsure call make a quest risky", async () => {
  assert.deepEqual(riskWords("Migrate the users table and delete old rows"), ["changes the database", "deletes things"]);
  const { dir, store, w, q, council } = setup([]);
  q.description = "Migrate the users table and delete old rows";
  assert.equal((await assessRisk(w, store, council, q, dir))!.risky, true);
  assert.equal(q.approved, false, "a risky quest waits for your nod");
  const easy: Enemy = { ...q, id: "q2", description: "Fix a typo in the footer", approved: undefined, risk: undefined };
  assert.equal((await assessRisk(w, store, council, easy, dir))!.risky, false);
  const one: Enemy = { ...q, id: "q3", description: "Tidy up the login form", approved: undefined, risk: undefined };
  assert.equal((await assessRisk(w, store, council, one, dir))!.risky, true, "with no Seer, unsure counts as risky");
  seer(w);
  const one2: Enemy = { ...one, id: "q4", approved: undefined, risk: undefined };
  const r = await assessRisk(w, store, council, one2, dir);
  assert.equal(r!.risky, false, "a seated Seer can clear it unanimously");
  assert.equal(r!.seat, "seer");
});

test("stuck: two idle turns bring in a stronger hero, who takes the next turn", async () => {
  const { dir, store, w, council } = setup([["anna", "true"], ["bo", "true"], ["cass", "true"], ["dee", "echo hi > hello.txt", 3]]);
  const r = await battle({ world: w, store, enemyId: "q1", partyIds: ["anna", "bo", "cass"], judge: { kind: "tests" }, cwd: dir, council });
  assert.equal(r.verdict.outcome, "victory");
  assert.deepEqual(r.party.map((p) => p.characterId), ["anna", "bo", "dee"], "Cass never needed a turn");
  assert.equal(council.decisions().filter((d) => d.kind === "stuck").at(-1)?.answer, "help");
});

test("stuck: with nobody stronger free, two idle turns end in a retreat", async () => {
  const { dir, store, w, council } = setup([["anna", "true"], ["bo", "true"], ["cass", "echo hi > hello.txt"]]);
  const r = await battle({ world: w, store, enemyId: "q1", partyIds: ["anna", "bo", "cass"], judge: { kind: "tests" }, cwd: dir, council });
  assert.notEqual(r.verdict.outcome, "victory");
  assert.equal(r.party.length, 2, "Cass never fought, so she isn't blamed");
  assert.equal(w.party.find((c) => c.id === "cass")!.records.fighter?.battles ?? 0, 0);
});

test("stuck: once every check passes, the rest of the party stands down", async () => {
  const { dir, store, w, council } = setup([["anna", "echo hi > hello.txt"], ["bo", "echo extra > extra.txt"]]);
  const r = await battle({ world: w, store, enemyId: "q1", partyIds: ["anna", "bo"], judge: { kind: "tests" }, cwd: dir, council });
  assert.equal(r.verdict.outcome, "victory");
  assert.deepEqual(r.party.map((p) => p.characterId), ["anna"]);
  assert.ok(!existsSync(join(r.instance!.path, "extra.txt")));
});
