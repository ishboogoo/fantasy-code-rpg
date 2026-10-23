import { test } from "node:test";
import assert from "node:assert/strict";
import { classify } from "../src/gate.ts";
import { permissionsFor } from "../src/rules.ts";

const T = (n: 0 | 1 | 2 | 3 | 4) => permissionsFor(n);

test("novices can read but not write", () => {
  assert.equal(classify("Read", { file_path: "a.ts" }, T(0)).allow, true);
  assert.equal(classify("Edit", { file_path: "a.ts" }, T(0)).allow, false);
  assert.equal(classify("Edit", { file_path: "a.ts" }, T(1)).allow, true);
});

test("commands unlock at T2, network and PRs at T3, merge at T4", () => {
  assert.equal(classify("Bash", { command: "npm test" }, T(1)).allow, false);
  assert.equal(classify("Bash", { command: "npm test" }, T(2)).allow, true);
  assert.equal(classify("Bash", { command: "curl https://x" }, T(2)).allow, false);
  assert.equal(classify("Bash", { command: "git push origin feat" }, T(2)).allow, false);
  assert.equal(classify("Bash", { command: "git push origin feat" }, T(3)).allow, true);
  assert.equal(classify("Bash", { command: "gh pr merge 12" }, T(3)).allow, false);
  assert.equal(classify("Bash", { command: "gh pr merge 12" }, T(4)).allow, true);
});

test("some things are forbidden even to heroes", () => {
  assert.equal(classify("Bash", { command: "git push --force origin feat" }, T(4)).allow, false);
  assert.equal(classify("Bash", { command: "rm -rf /" }, T(4)).allow, false);
  assert.equal(classify("Edit", { file_path: ".fcrpg/world.json" }, T(4)).allow, false, "no editing your own stats");
  assert.equal(classify("Write", { file_path: "/repo/.fcrpg/chronicle/lore.md" }, T(4)).allow, false, "no rewriting the Chronicle directly");
  assert.equal(classify("Bash", { command: "sed -i s/a/b/ .fcrpg/world.json" }, T(4)).allow, false, "no shell edits to the criteria");
  assert.equal(classify("Read", { file_path: ".fcrpg/chronicle/lore.md" }, T(0)).allow, true, "reading lore is encouraged");
});

test("summoning sub-agents is a T4 power; unknown tools are denied", () => {
  assert.equal(classify("Task", {}, T(3)).allow, false);
  assert.equal(classify("Task", {}, T(4)).allow, true);
  assert.equal(classify("TeleportToProd", {}, T(4)).allow, false);
});
