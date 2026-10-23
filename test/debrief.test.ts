import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/store.ts";
import { Council } from "../src/council.ts";
import { battle, undoBattle } from "../src/battle.ts";
import { request, seer, setPlayStyle } from "../src/stages.ts";
import { ledgerRecords, recordChoice, lastLeadSuggestion, PREFERENCE_CAP } from "../src/ledger.ts";
import { recommendParty } from "../src/party.ts";
import type { Character } from "../src/types.ts";

const hero = (id: string, job: Character["job"], tier: Character["tier"] = 1): Character => ({
  id, name: id[0].toUpperCase() + id.slice(1), adapter: "mock", job, tier, level: 3, xp: 0, totalXp: 0, records: {}, status: [], recruitedAt: "", adapterConfig: { skill: "1", seed: "t" } });

function guild() {
  const dir = mkdtempSync(join(tmpdir(), "sp-deb-"));
  const store = new Store(dir); store.init();
  const w = store.load(); w.treasury.gold = 10;
  w.party.push(hero("aria", "fighter"), hero("bard", "bard"), hero("seer", "mage"));
  return { dir, store, w, council: new Council(store.chronicleDir) };
}

test("after a battle, a hero who didn't fight writes lessons into the lore, once each", async () => {
  const { dir, store, w } = guild();
  w.enemies.push({ id: "q1", name: "Typo", kind: "slime", level: 1, description: "", status: "lurking", budget: { gold: 1 },
    criteria: [{ id: "ok", description: "fixed", check: "true", met: false }] });
  await battle({ world: w, store, enemyId: "q1", partyIds: ["aria"], judge: { kind: "tests" }, cwd: dir, debrief: true });
  assert.match(store.lore(), /Run the whole test suite.*lesson from q1, written by (Bard|Seer)/);
  w.enemies.push({ id: "q2", name: "Typo 2", kind: "slime", level: 1, description: "", status: "lurking", budget: { gold: 1 },
    criteria: [{ id: "ok", description: "fixed", check: "true", met: false }] });
  await battle({ world: w, store, enemyId: "q2", partyIds: ["aria"], judge: { kind: "tests" }, cwd: dir, debrief: true });
  assert.equal(store.lore().split("Run the whole test suite").length - 1, 1, "the same lesson isn't written twice");
});

test("your reason for an undo becomes a house rule", async () => {
  const { dir, store, w } = guild();
  w.enemies.push({ id: "q1", name: "Colour", kind: "slime", level: 1, description: "", status: "lurking", budget: { gold: 1 },
    criteria: [{ id: "taste", description: "looks right", proof: "human", met: false }] });
  const r = await battle({ world: w, store, enemyId: "q1", partyIds: ["aria"], judge: { kind: "tests" }, cwd: dir, isolate: false });
  await undoBattle(w, store, r.id, dir, undefined, "We never use bright red in the UI.");
  assert.match(store.lore(), /House rule: We never use bright red in the UI\./);
});

test("the Seer is asked three times and only a unanimous answer decides", async () => {
  const { dir, store, w, council } = guild();
  w.settings = { playStyle: "story", seer: "seer" };
  const v = await seer(w, store, dir, "What kind of work?", ["build", "fix", "write"], "The checkout page crashes on submit");
  assert.equal(v?.answer, "fix");
  assert.equal(v?.agreement, 1);
  assert.equal(v?.votes.length, 3);
  // "Make it nicer" has no keywords for the Law, so the Seer's unanimous vote decides.
  const { quest } = await request(w, store, council, "Make the profile page nicer", dir);
  const d = council.decisions().filter((x) => x.kind === "quest-type").at(-1)!;
  assert.equal(d.seat, "seer");
  assert.equal(quest.questType, "build");
  setPlayStyle(w, "story");
});

test("the leads you pick teach the Ledger, but never outweigh real results", () => {
  const { w } = guild();
  for (let i = 0; i < 20; i++) recordChoice(w, "fix", "aria", "bard");
  const r = ledgerRecords(w, "fix");
  assert.equal(r.get("aria")!.successes, PREFERENCE_CAP);
  assert.equal(r.get("bard")!.failures, PREFERENCE_CAP);
  recordChoice(w, "fix", "aria", "aria");
  assert.equal(w.choices!.length, 20, "choosing the suggested hero isn't a preference");
  assert.equal(lastLeadSuggestion([{ kind: "party-lead", questId: "q", answer: null, suggestion: "bard" }], "q"), "bard");
  w.enemies.push({ id: "f1", name: "Bug", kind: "goblin", questType: "fix", level: 1, description: "", criteria: [], budget: {}, status: "lurking" });
  w.party.find((c) => c.id === "bard")!.tier = 1;
  const plan = recommendParty(w, w.enemies[0], 2, new Council(mkdtempSync(join(tmpdir(), "c-"))));
  assert.equal(plan.members[0].id, "aria", "after many picks, your favourite is suggested");
});
