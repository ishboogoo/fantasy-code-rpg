import { test } from "node:test";
import assert from "node:assert/strict";
import { isReadOnlyCommand } from "../src/gate.ts";
import { tierFor } from "../src/rules.ts";

test("harmless looking commands count as reading", () => {
  for (const c of ["git log --oneline -5", "git status", "ls -la", "cat README.md | head -20", "grep -rn foo src 2>/dev/null"])
    assert.equal(isReadOnlyCommand(c), true, c);
  for (const c of ["rm -rf x", "echo hi > a.txt", "find . -delete", "sed -i s/a/b/ f", "npm test", "ls && rm x", "cat $(whoami)"])
    assert.equal(isReadOnlyCommand(c), false, c);
});

test("each permission unlocks at a known rank", () => {
  assert.equal(tierFor("read"), 0);
  assert.ok(tierFor("write") >= 1);
  assert.ok(tierFor("exec") >= tierFor("write"));
});
