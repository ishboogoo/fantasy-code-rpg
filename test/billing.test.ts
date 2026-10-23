import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, chmodSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claudeCode } from "../src/adapters/cli.ts";
import { permissionsFor } from "../src/rules.ts";
import type { Character } from "../src/types.ts";

// A fake `claude` on PATH that records whether it saw an API key.
function fakeClaude(): string {
  const dir = mkdtempSync(join(tmpdir(), "fake-claude-"));
  const bin = join(dir, "claude");
  writeFileSync(bin, `#!/bin/sh\necho "key=\${ANTHROPIC_API_KEY:-none}" > "${dir}/seen"\necho '{"result":"ok","total_cost_usd":0.5,"num_turns":2}'\n`);
  chmodSync(bin, 0o755);
  return dir;
}

test("heroes on your Claude plan never use an API key from the environment", { skip: process.platform === "win32" }, async () => {
  const dir = fakeClaude();
  const env = { PATH: process.env.PATH, KEY: process.env.ANTHROPIC_API_KEY };
  process.env.PATH = `${dir}:${process.env.PATH}`;
  process.env.ANTHROPIC_API_KEY = "sk-test-not-real";
  try {
    const hero = { id: "a", name: "A", adapter: "claude-code", job: "fighter", tier: 1, level: 1, xp: 0, totalXp: 0, records: {}, status: [], recruitedAt: "" } as Character;
    const plan = await claudeCode.run({ character: hero, prompt: "hi", cwd: dir, permissions: permissionsFor(1), maxTurns: 2, goldLimit: 1 });
    assert.equal(readFileSync(join(dir, "seen"), "utf8").trim(), "key=none");
    assert.equal(plan.costGold, 0, "no gold: it's your plan");
    const api = await claudeCode.run({ character: { ...hero, adapterConfig: { billing: "api" } }, prompt: "hi", cwd: dir, permissions: permissionsFor(1), maxTurns: 2, goldLimit: 1 });
    assert.equal(readFileSync(join(dir, "seen"), "utf8").trim(), "key=sk-test-not-real");
    assert.equal(api.costGold, 0.5, "an API hero spends gold");
  } finally {
    process.env.PATH = env.PATH;
    if (env.KEY === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = env.KEY;
  }
});
