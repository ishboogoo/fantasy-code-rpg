import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/store.ts";
import { startPlay } from "../src/play.ts";
import { moveFor } from "../src/hooks.ts";

test("the browser server needs its one-time key, and never sends hero settings", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sp-play-"));
  const store = new Store(dir);
  store.init();
  const w = store.load();
  w.party.push({ id: "aria", name: "Aria", adapter: "anthropic-api", job: "fighter", tier: 1, level: 2, xp: 0, totalXp: 0, records: {}, status: [],
    recruitedAt: "", adapterConfig: { baseUrl: "https://secret.example", priceIn: "3" } });
  store.save(w);
  const server = await startPlay(dir, 0);
  try {
    const base = server.url.split("?")[0];
    const token = new URL(server.url).searchParams.get("t")!;
    assert.equal((await fetch(`${base}api/state`)).status, 403);
    assert.equal((await fetch(base)).status, 403, "the page itself needs the key");
    assert.equal((await fetch(`${base}gen/hero.js`)).status, 200, "art generators are public");
    const state = await (await fetch(`${base}api/state`, { headers: { "x-savepoint-token": token } })).json();
    assert.equal(state.party[0].company, "Claude");
    assert.doesNotMatch(JSON.stringify(state), /secret\.example/);
    // Events appended to the Chronicle stream to the page.
    const res = await fetch(`${base}api/events?t=${token}`);
    const reader = res.body!.getReader();
    store.event({ type: "action", hero: "aria", move: "FORGE", target: "src/a.ts", allowed: true });
    let got = "";
    const deadline = Date.now() + 3000;
    while (!got.includes("FORGE") && Date.now() < deadline) got += new TextDecoder().decode((await reader.read()).value);
    assert.match(got, /FORGE/);
    await reader.cancel();
  } finally {
    server.close();
  }
});

test("tool calls become named moves", () => {
  assert.deepEqual(moveFor("claude", "Edit", { file_path: "src/a.ts" }), { move: "FORGE", target: "src/a.ts" });
  assert.equal(moveFor("claude", "Bash", { command: "npm test" }).move, "TRIAL");
  assert.equal(moveFor("gemini", "read_file", { absolute_path: "src/a.ts" }).move, "SCAN");
  assert.equal(moveFor("codex", "apply_patch", { command: "*** Begin Patch\n*** Update File: src/b.ts\n" }).target, "src/b.ts");
});

test("the browser can run the whole loop: request, approve, battle, keep", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sp-play2-"));
  const store = new Store(dir);
  store.init();
  const w = store.load();
  for (const [id, job] of [["aria", "fighter"], ["mira", "mage"], ["cass", "cleric"]] as const) {
    w.party.push({ id, name: id, adapter: "mock", job, tier: 1, level: 2, xp: 0, totalXp: 0, records: {}, status: [], recruitedAt: "", adapterConfig: { skill: "1", seed: "t" } });
  }
  store.save(w);
  const server = await startPlay(dir, 0);
  const token = new URL(server.url).searchParams.get("t")!;
  const base = server.url.split("?")[0];
  const cmd = async (b: Record<string, unknown>) => (await fetch(`${base}api/cmd`, { method: "POST", headers: { "x-savepoint-token": token }, body: JSON.stringify(b) })).json();
  try {
    const r = await cmd({ cmd: "request", text: "Login page crashes when the email field is empty" });
    assert.equal(r.ok, true, r.message);
    const id = r.quest;
    assert.equal((await cmd({ cmd: "suggest", id })).members[0].role, "lead");
    const fight = await cmd({ cmd: "battle", id });
    assert.equal(fight.ok, true, fight.message);
    assert.equal((await cmd({ cmd: "approve", id })).ok, false, "changes wait while a battle is under way");
    let state: { fighting: string | null; battles: Array<{ outcome: string }> } = { fighting: id, battles: [] };
    for (let i = 0; i < 50 && (state.fighting || !state.battles.length); i++) {
      await new Promise((res) => setTimeout(res, 100));
      state = await (await fetch(`${base}api/state`, { headers: { "x-savepoint-token": token } })).json();
    }
    assert.equal(state.battles.length, 1);
    const rec = await cmd({ cmd: "recruit", name: "Rook", job: "thief", adapter: "mock", race: "beastkin", build: "masculine" });
    assert.equal(rec.ok, true, rec.message);
    assert.equal((await cmd({ cmd: "settings", language: "ja" })).settings.language, "ja");
    assert.equal((await cmd({ cmd: "nonsense" })).ok, false);
  } finally {
    server.close();
  }
});
