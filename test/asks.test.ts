import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { AskBook } from "../src/asks.ts";
import { Store } from "../src/store.ts";
import { battle } from "../src/battle.ts";
import type { Character } from "../src/types.ts";

const CLI = join(import.meta.dirname, "..", "src", "cli.ts");

function guild(): { dir: string; store: Store } {
  const dir = mkdtempSync(join(tmpdir(), "sp-ask-"));
  const store = new Store(dir);
  store.init();
  const w = store.load();
  const hero = (id: string, tier: Character["tier"], extra: Partial<Character> = {}): Character => ({
    id, name: id[0].toUpperCase() + id.slice(1), adapter: "claude-code", job: "fighter", tier, level: 3, xp: 0, totalXp: 0, records: {}, status: [], recruitedAt: "", ...extra });
  w.party.push(hero("novice", 0), hero("knight", 2));
  w.settings = { playStyle: "story", askTimeoutSec: 5 };
  store.save(w);
  return { dir, store };
}

/** Run the real Gatekeeper hook as Claude Code would, and return what it prints. */
function gate(dir: string, hero: string, event: Record<string, unknown>): { done: Promise<string> } {
  const child = spawn(process.execPath, [CLI, "gate", "--cli", "claude"], {
    env: { ...process.env, FCRPG_CHARACTER: hero, FCRPG_HOME: join(dir, ".fcrpg"), FCRPG_QUEST: "q1" },
  });
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  child.stdin.end(JSON.stringify(event));
  return { done: new Promise((res) => child.on("close", () => res(out))) };
}

async function nextAsk(book: AskBook): Promise<string> {
  for (let i = 0; i < 50; i++) { const w = book.waiting(); if (w.length) return w[0].id; await new Promise((r) => setTimeout(r, 100)); }
  throw new Error("no question appeared");
}

test("a question waits for an answer, and no answer in time means no", async () => {
  const book = new AskBook(mkdtempSync(join(tmpdir(), "sp-book-")));
  const a = book.create({ hero: "rook", tool: "Bash", move: "TRIAL", target: "npm test", need: "exec", reason: "x" });
  setTimeout(() => book.decide(a.id, "allow"), 150);
  assert.equal((await book.wait(a.id, 3000, 50)).decision, "allow");
  assert.throws(() => book.decide(a.id, "deny"), /already/);
  const b = book.create({ hero: "rook", tool: "Bash", move: "TRIAL", target: "npm test", need: "exec", reason: "x" });
  const expired = await book.wait(b.id, 120, 30);
  assert.equal(expired.status, "expired");
  assert.equal(expired.decision, "deny");
});

test("the real hook pauses the hero until you allow it once, with no penalty", async () => {
  const { dir, store } = guild();
  const run = gate(dir, "novice", { tool_name: "Edit", tool_input: { file_path: "src/a.ts" } });
  const book = new AskBook(store.chronicleDir);
  book.decide(await nextAsk(book), "allow");
  assert.match(await run.done, /"permissionDecision":"allow"/, "allowed once: an explicit allow, so the CLI's own tool list doesn't block it");
  assert.equal(store.violationCount("novice"), 0, "asking is not a violation");
});

test("deny and silence both say no, still without a violation", async () => {
  const { dir, store } = guild();
  const run = gate(dir, "novice", { tool_name: "Edit", tool_input: { file_path: "src/a.ts" } });
  const book = new AskBook(store.chronicleDir);
  book.decide(await nextAsk(book), "deny");
  assert.match(await run.done, /"permissionDecision":"deny".*said no/);
  assert.equal(store.violationCount("novice"), 0);
});

test("forbidden actions are never asked about: denied at once and recorded", async () => {
  const { dir, store } = guild();
  const out = await gate(dir, "knight", { tool_name: "Bash", tool_input: { command: "git push --force origin main" } }).done;
  assert.match(out, /deny/);
  assert.equal(new AskBook(store.chronicleDir).all().length, 0);
  assert.equal(store.violationCount("knight"), 1);
  const events = readFileSync(store.eventsFile, "utf8");
  assert.match(events, /"allowed":false/);
  assert.ok(existsSync(store.eventsFile));
});

test("a job you hand over passes to the chosen hero in the same battle", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sp-hand-"));
  const store = new Store(dir);
  store.init();
  const w = store.load();
  w.treasury.gold = 5;
  const asks = join(dir, ".fcrpg", "chronicle", "asks");
  // A shell hero that, mid-turn, needs something it may not do; you hand the job to Cass.
  const cmd = `mkdir -p ${asks} && printf '{"id":"h1","hero":"smith","quest":"q1","tool":"Bash","move":"CAST","target":"git push","need":"openPr","reason":"x","status":"decided","decision":"handoff","to":"cass","at":"%s"}' "$(date -u +%Y-%m-%dT%H:%M:%S.999Z)" > ${asks}/h1.json`;
  w.party.push(
    { id: "smith", name: "Smith", adapter: "shell", job: "fighter", tier: 2, level: 8, xp: 0, totalXp: 0, records: {}, status: [], recruitedAt: "", adapterConfig: { command: cmd } },
    { id: "cass", name: "Cass", adapter: "mock", job: "cleric", tier: 3, level: 8, xp: 0, totalXp: 0, records: {}, status: [], recruitedAt: "", adapterConfig: { skill: "1", seed: "t" } },
  );
  w.enemies.push({ id: "q1", name: "Ship it", kind: "slime", level: 1, description: "", status: "lurking", budget: { gold: 1 },
    criteria: [{ id: "ok", description: "done", check: "true", met: false }] });
  const lines: string[] = [];
  const r = await battle({ world: w, store, enemyId: "q1", partyIds: ["smith"], judge: { kind: "tests" }, cwd: dir, isolate: false, onEvent: (l) => lines.push(l) });
  assert.deepEqual(r.party.map((p) => p.characterId), ["smith", "cass"]);
  assert.ok(lines.some((l) => /hands the job to Cass/.test(l)));
});
