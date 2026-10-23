import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { Store } from "../src/store.ts";
import { Council } from "../src/council.ts";
import { battle, keepBattle } from "../src/battle.ts";
import type { Character } from "../src/types.ts";

process.env.SAVEPOINT_INSTANCES = mkdtempSync(join(tmpdir(), "sp-pi-"));

function setup(cmdA: string, cmdB: string) {
  const dir = mkdtempSync(join(tmpdir(), "sp-pincer-"));
  const git = (...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: dir });
  git("init", "-q", "-b", "main"); writeFileSync(join(dir, "README.md"), "x\n"); git("add", "-A"); git("commit", "-q", "-m", "init");
  const store = new Store(dir); store.init();
  const w = store.load(); w.treasury.gold = 10;
  const smith = (id: string, cmd: string, adapter: Character["adapter"] = "shell"): Character => ({ id, name: id[0].toUpperCase() + id.slice(1), adapter, job: "fighter", tier: 2,
    level: 8, xp: 0, totalXp: 0, records: {}, status: [], recruitedAt: "", adapterConfig: { command: cmd, skill: "1", seed: "t" } });
  w.party.push(smith("anna", cmdA), smith("bo", cmdB), { ...smith("cass", "", "mock"), job: "cleric" });
  w.enemies.push({ id: "q1", name: "Add a greeting", kind: "golem", questType: "build", level: 2, description: "", status: "lurking", budget: { gold: 2 },
    criteria: [{ id: "file", description: "hello.txt exists", check: "test -f hello.txt", met: false }, { id: "nice", description: "the greeting is good", proof: "judge", met: false }] });
  return { dir, store, w, council: new Council(store.chronicleDir) };
}

test("Pincer: the approach that passes more checks wins; the other is thrown away", async () => {
  const { dir, store, w, council } = setup("echo hi > hello.txt", "echo nope > other.txt");
  const r = await battle({ world: w, store, enemyId: "q1", partyIds: ["anna", "bo"], judge: { kind: "auto" }, cwd: dir, council, formation: "pincer" });
  assert.equal(r.party[0].characterId, "anna", "the winner leads the report");
  assert.equal(r.alternate, undefined);
  assert.equal(council.decisions().find((d) => d.kind === "compare")?.seat, "law");
  assert.equal(w.party.find((c) => c.id === "bo")!.records.fighter?.battles ?? 0, 0, "the other approach isn't counted against its hero");
  await keepBattle(w, store, r.id, dir);
  assert.ok(existsSync(join(dir, "hello.txt")));
  assert.ok(!existsSync(join(dir, "other.txt")));
});

test("Pincer: when checks tie, judges compare both orders and the better one wins", async () => {
  const { dir, store, w, council } = setup("echo GOOD > hello.txt", "echo meh > hello.txt");
  const r = await battle({ world: w, store, enemyId: "q1", partyIds: ["bo", "anna"], judge: { kind: "auto" }, cwd: dir, council, formation: "pincer" });
  assert.equal(r.party[0].characterId, "anna");
  assert.equal(council.decisions().find((d) => d.kind === "compare")?.seat, "trial");
  await keepBattle(w, store, r.id, dir);
  assert.equal(readFileSync(join(dir, "hello.txt"), "utf8").trim(), "GOOD");
});

test("Pincer: when the judges can't tell, both are kept and you choose", async () => {
  const { dir, store, w, council } = setup("echo one > hello.txt", "echo two > hello.txt");
  const r = await battle({ world: w, store, enemyId: "q1", partyIds: ["anna", "bo"], judge: { kind: "auto" }, cwd: dir, council, formation: "pincer" });
  assert.ok(r.alternate, "the other approach is kept");
  await keepBattle(w, store, r.id, dir, true);
  assert.equal(readFileSync(join(dir, "hello.txt"), "utf8").trim(), "two", "you kept the other approach");
});
