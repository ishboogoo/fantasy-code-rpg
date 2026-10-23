import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/store.ts";
import { battle } from "../src/battle.ts";
import { moveFor } from "../src/hooks.ts";
import { riskWords } from "../src/stages.ts";
import { checkParty } from "../src/party.ts";
import type { Character, Enemy } from "../src/types.ts";

process.env.FCRPG_INSTANCES = mkdtempSync(join(tmpdir(), "sp-live-"));

function setup(cmds: string[], criteria: Enemy["criteria"]) {
  const dir = mkdtempSync(join(tmpdir(), "sp-live-"));
  const git = (...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: dir });
  git("init", "-q", "-b", "main"); writeFileSync(join(dir, "README.md"), "x\n"); git("add", "-A"); git("commit", "-q", "-m", "init");
  const store = new Store(dir); store.init();
  const w = store.load(); w.treasury.gold = 10;
  cmds.forEach((cmd, i) => w.party.push({ id: `h${i}`, name: `H${i}`, adapter: "shell", job: "fighter", tier: 2, level: 8, xp: 0, totalXp: 0,
    records: {}, status: [], recruitedAt: "", adapterConfig: { command: cmd } } as Character));
  w.enemies.push({ id: "q1", name: "Slime", kind: "slime", level: 1, description: "", status: "lurking", budget: { gold: 2, maxTurns: 5 }, criteria });
  return { dir, store, w };
}
const events = (store: Store) => readFileSync(store.eventsFile, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const exists = (f: string) => `node -e "process.exit(require('fs').existsSync('${f}')?0:1)"`;

test("the enemy's HP drops live as checks pass, and it heals when one breaks again", async () => {
  const { dir, store, w } = setup(["node -e \"require('fs').writeFileSync('a.txt','a')\"", "node -e \"require('fs').rmSync('a.txt')\""],
    [{ id: "a", description: "a.txt exists", check: exists("a.txt"), met: false }, { id: "b", description: "b.txt exists", check: exists("b.txt"), met: false }]);
  await battle({ world: w, store, enemyId: "q1", partyIds: ["h0", "h1"], judge: { kind: "tests" }, cwd: dir });
  const ev = events(store);
  const progress = ev.filter((e) => e.type === "progress");
  assert.deepEqual(progress.map((e) => [e.hero, e.hp, e.change]), [["h0", 1, -1], ["h1", 2, 1]]);
  assert.equal(ev.find((e) => e.type === "turn_limit")?.maxTurns, 5);
  assert.equal(ev.filter((e) => e.type === "turn_end").length, 2, "the screen knows when each hero stops working");
  assert.ok(ev.some((e) => e.type === "say" && /recovers 1 HP/.test(e.text)));
});

test("checks get FCRPG_BASE, so 'what changed' works after save points commit the work", async () => {
  const changedOnlyA = `node -e "const o=require('child_process').execSync('git diff --name-only '+(process.env.FCRPG_BASE||'HEAD')).toString().trim();process.exit(o==='a.txt'?0:1)"`;
  const { dir, store, w } = setup(["node -e \"require('fs').writeFileSync('a.txt','a')\""],
    [{ id: "only", description: "only a.txt changed", check: changedOnlyA, met: false }]);
  const r = await battle({ world: w, store, enemyId: "q1", partyIds: ["h0"], judge: { kind: "tests" }, cwd: dir });
  assert.equal(r.verdict.outcome, "victory");
});

test("paths inside the battle's copy are shown relative to it", () => {
  const root = "C:\\Users\\a\\.cache\\fcrpg\\instances\\proj-7a7f\\4e71";
  assert.equal(moveFor("claude", "Edit", { file_path: root + "\\README.md" }, root).target, "README.md");
  assert.equal(moveFor("claude", "Read", { file_path: "/tmp/x/proj/src/web/ui.js" }, "/tmp/x/proj/").target, "src/web/ui.js");
  assert.equal(moveFor("claude", "Bash", { command: `ls ${root}` }, root).target, "ls .");
  assert.equal(moveFor("claude", "Read", { file_path: "/etc/hosts" }, "/tmp/x/proj").target, "/etc/hosts");
  assert.equal(moveFor("claude", "Read", { file_path: "/tmp/x/project/file" }, "/tmp/x/proj").target, "/tmp/x/project/file", "a sibling isn't inside");
  assert.equal(moveFor("claude", "Read", { file_path: "/TMP/x/proj/a" }, "/tmp/x/proj").target, "/TMP/x/proj/a", "exact case off Windows");
  assert.equal(moveFor("claude", "Read", { file_path: "c:/users/A/proj/a.ts" }, "C:\\Users\\a\\proj").target, "a.ts", "Windows: any case, either slash");
});

test("security risk words match whole ideas, not lookalikes", () => {
  for (const text of ["Credit the author in the README", "Document the permission system in plain words", "Fix the tokenizer", "List every keyboard shortcut"])
    assert.deepEqual(riskWords(text), [], text);
  for (const text of ["Add OAuth login", "Rotate the API tokens", "Check permission rules on uploads", "Hash passwords with bcrypt", "Fix the auth middleware"])
    assert.deepEqual(riskWords(text), ["touches security"], text);
});

test("the War Room says when every possible judge shares the party's AI company", () => {
  const { w } = setup(["true", "true", "true"], [{ id: "a", description: "x", met: false }]);
  w.party.forEach((c) => { c.adapter = "claude-code"; c.tier = 1; });
  const picks = [{ id: "h0", role: "lead" as const }];
  assert.ok(checkParty(w, w.enemies[0], picks).some((x) => /same AI company/.test(x)));
  w.party[2].adapter = "codex";
  assert.ok(!checkParty(w, w.enemies[0], picks).some((x) => /same AI company as the party/.test(x)));
});

test("simulated heroes don't trigger the same-company judge warning", () => {
  const { w } = setup(["true", "true"], [{ id: "a", description: "x", met: false }]);
  w.party.forEach((c) => { c.adapter = "mock"; });
  assert.ok(!checkParty(w, w.enemies[0], [{ id: "h0", role: "lead" }]).some((x) => /same AI company/.test(x)));
});
