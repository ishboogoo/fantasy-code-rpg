import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/store.ts";

const cli = join(import.meta.dirname, "..", "src", "cli.ts");
const run = (dir: string, ...a: string[]) => execFileSync(process.execPath, [cli, ...a], { cwd: dir, encoding: "utf8" });

test("a quest finished another way can be closed, or dropped", () => {
  const dir = mkdtempSync(join(tmpdir(), "sp-close-"));
  const store = new Store(dir); store.init();
  const w = store.load();
  for (const id of ["q1", "q2"]) w.enemies.push({ id, name: id, kind: "slime", level: 1, description: "", status: "lurking", budget: { gold: 1 }, criteria: [{ id: "a", description: "x", met: false }] });
  store.save(w);
  assert.match(run(dir, "close", "q1"), /marked done/);
  assert.match(run(dir, "close", "q2", "--drop"), /dropped/);
  const after = new Store(dir).load();
  assert.deepEqual(after.enemies.map((e) => e.status), ["defeated", "fled"]);
  assert.deepEqual(Object.keys(after.party), [], "nobody's record changes");
  assert.throws(() => run(dir, "battle", "q2", "--party", "nobody"), /dropped/, "a dropped quest can't be fought");
});
