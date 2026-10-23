import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { decideTool, denyOutput, keepGoingOutput, stopGate, codexHookArgs, MAX_PUSHES } from "../src/hooks.ts";
import { permissionsFor } from "../src/rules.ts";
import { Store } from "../src/store.ts";
import { Council } from "../src/council.ts";
import { importGithub, typeFromLabels } from "../src/importers.ts";
import type { Enemy } from "../src/types.ts";

const T0 = permissionsFor(0), T1 = permissionsFor(1), T2 = permissionsFor(2);

test("one rulebook reads Codex and Gemini tool calls the same way as Claude Code's", () => {
  // A Novice may read everywhere and write nowhere, whatever the CLI calls its tools.
  assert.equal(decideTool("codex", "apply_patch", { command: "*** Update File: src/a.ts" }, T0).allow, false);
  assert.equal(decideTool("codex", "apply_patch", { command: "*** Update File: src/a.ts" }, T1).allow, true);
  assert.equal(decideTool("gemini", "write_file", { file_path: "src/a.ts" }, T0).allow, false);
  assert.equal(decideTool("gemini", "read_file", { absolute_path: "src/a.ts" }, T0).allow, true);
  assert.equal(decideTool("gemini", "run_shell_command", { command: "npm test" }, T1).allow, false, "commands unlock at T2");
  assert.equal(decideTool("gemini", "run_shell_command", { command: "npm test" }, T2).allow, true);
  assert.equal(decideTool("codex", "Bash", { command: "git push origin main" }, T2).allow, false);
  // Nobody touches the harness's own records, through any CLI.
  assert.equal(decideTool("codex", "apply_patch", { command: "*** Update File: .savepoint/world.json" }, permissionsFor(4)).allow, false);
  assert.equal(decideTool("gemini", "replace", { file_path: "/repo/.savepoint/world.json" }, permissionsFor(4)).allow, false);
  // Unknown tools are denied.
  assert.equal(decideTool("gemini", "some_new_tool", {}, permissionsFor(4)).allow, false);
});

test("each CLI gets its own reply format", () => {
  assert.equal(JSON.parse(denyOutput("claude", "no")).hookSpecificOutput.permissionDecision, "deny");
  assert.equal(JSON.parse(denyOutput("codex", "no")).hookSpecificOutput.permissionDecision, "deny");
  assert.equal(JSON.parse(denyOutput("gemini", "no")).decision, "deny");
  assert.equal(JSON.parse(keepGoingOutput("claude", "x")).decision, "block");
  assert.equal(JSON.parse(keepGoingOutput("gemini", "x")).decision, "deny");
  const args = codexHookArgs({ gate: "node 'x' gate", stop: "node x stop-gate" });
  assert.ok(args.includes("-c") && args.some((a) => a.startsWith("hooks.PreToolUse=")));
});

test("no proof, no victory: a hero can't stop while a check fails, at most three times", async () => {
  const home = mkdtempSync(join(tmpdir(), "sp-home-"));
  const work = mkdtempSync(join(tmpdir(), "sp-work-"));
  const quest: Enemy = { id: "q1", name: "x", kind: "slime", level: 1, description: "", status: "engaged", budget: {},
    criteria: [{ id: "file", description: "out.txt exists", check: "test -f out.txt", met: false }] };
  for (let i = 0; i < MAX_PUSHES; i++) {
    const r = await stopGate({ home, quest, characterId: "aria", cwd: work });
    assert.equal(r.keepGoing, true);
    assert.match(r.reason, /file/);
  }
  const capped = await stopGate({ home, quest, characterId: "aria", cwd: work });
  assert.equal(capped.keepGoing, false, "a stuck hero isn't looped forever");
  writeFileSync(join(work, "out.txt"), "x");
  const home2 = mkdtempSync(join(tmpdir(), "sp-home-"));
  assert.equal((await stopGate({ home: home2, quest, characterId: "aria", cwd: work })).keepGoing, false, "passes: free to stop");
});

test("GitHub labels set the quest type only when they agree", () => {
  assert.equal(typeFromLabels(["bug", "p1"])?.type, "fix");
  assert.equal(typeFromLabels(["documentation"])?.type, "write");
  assert.equal(typeFromLabels(["bug", "enhancement"]), null);
  assert.equal(typeFromLabels(["p2"]), null);
});

test("open GitHub issues become quests, once each", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sp-gh-"));
  const bin = join(dir, "bin");
  mkdirSync(bin);
  const issues = [{ number: 7, title: "Checkout fails for some users", body: "Steps...", url: "https://github.com/o/r/issues/7", labels: [{ name: "bug" }] },
    { number: 8, title: "Update the setup guide", body: "", url: "https://github.com/o/r/issues/8", labels: [] }];
  writeFileSync(join(bin, "gh"), `#!/bin/sh\necho '${JSON.stringify(issues)}'\n`);
  chmodSync(join(bin, "gh"), 0o755);
  const oldPath = process.env.PATH;
  process.env.PATH = `${bin}:${oldPath}`;
  try {
    const store = new Store(dir);
    store.init();
    const w = store.load();
    const council = new Council(store.chronicleDir);
    const r = await importGithub(w, store, council, dir);
    assert.equal(r.added.length, 2);
    const q7 = w.enemies.find((e) => e.id === "gh-7")!;
    assert.equal(q7.questType, "fix");
    assert.equal(q7.source, "https://github.com/o/r/issues/7");
    assert.equal(w.enemies.find((e) => e.id === "gh-8")!.questType, "write", "no label: the Law reads the title");
    const again = await importGithub(w, store, council, dir);
    assert.equal(again.added.length, 0);
    assert.equal(again.skipped, 2);
  } finally {
    process.env.PATH = oldPath;
  }
  void execFileSync;
});
