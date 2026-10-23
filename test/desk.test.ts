import { test } from "node:test";
import assert from "node:assert/strict";
import { claudeError } from "../src/adapters/cli.ts";
import { deskTurns } from "../src/stages.ts";

test("Claude Code errors say what happened and what to do", () => {
  assert.match(claudeError("error_max_turns", undefined, 8), /ran out of turns \(8\)/);
  assert.match(claudeError("success", "Claude AI usage limit reached|1761300000", 8), /hit a Claude limit.*Wait a while/);
  assert.match(claudeError("error_during_execution", "", 8), /stopped with an error\. Try again/);
  assert.match(claudeError(undefined, "", 8), /reported an error/);
});

test("scouts and planners get more turns for bigger quests", () => {
  assert.equal(deskTurns({ level: 1 }), 9);
  assert.equal(deskTurns({ level: 5 }), 21);
  assert.equal(deskTurns({ level: 10 }), 30);
});
