import { test } from "node:test";
import assert from "node:assert/strict";
import { recommendParty, checkParty } from "../src/party.ts";
import type { Character, Enemy, World } from "../src/types.ts";

const hero = (id: string, job: Character["job"], tier: Character["tier"], adapter: Character["adapter"], wins = 10, losses = 1): Character => ({
  id, name: id, adapter, job, tier, level: 5, xp: 0, totalXp: 0, status: [], recruitedAt: "",
  records: { [job]: { successes: wins, failures: losses, battles: wins + losses } },
});
const enemy: Enemy = { id: "e1", name: "Login Lich", kind: "lich", level: 3, description: "", criteria: [], budget: { gold: 1 }, status: "lurking" };
const world = (party: Character[]): World => ({ version: 1, party, enemies: [enemy], treasury: { gold: 10, spent: 0 }, battles: [] });

test("lead must be trusted to change files; judge comes from another AI company", () => {
  const w = world([hero("novice", "thief", 0, "mock", 30, 0), hero("aria", "fighter", 2, "claude-code"), hero("cass", "cleric", 1, "gemini-cli"), hero("mira", "mage", 1, "anthropic-api")]);
  const plan = recommendParty(w, enemy);
  const lead = plan.members.find((m) => m.role === "lead")!;
  const judge = plan.members.find((m) => m.role === "judge")!;
  assert.notEqual(lead.id, "novice");
  const vendorOf: Record<string, string> = { aria: "anthropic", mira: "anthropic", cass: "google", novice: "mock" };
  assert.notEqual(vendorOf[judge.id], vendorOf[lead.id]);
  assert.notEqual(judge.id, "novice");
  assert.equal(plan.members.length, 3);
});

test("custom party gets plain-language warnings", () => {
  const w = world([hero("novice", "fighter", 0, "mock"), hero("aria", "fighter", 2, "claude-code"), hero("mira", "mage", 1, "anthropic-api")]);
  const warn = checkParty(w, enemy, [{ id: "novice", role: "lead" }, { id: "mira", role: "judge" }]);
  assert.ok(warn.some((s) => s.includes("isn't trusted to change files")));
  assert.ok(warn.some((s) => s.includes("strong against this monster")));
  const same = checkParty(w, enemy, [{ id: "aria", role: "lead" }, { id: "mira", role: "judge" }]);
  assert.ok(same.some((s) => s.includes("same AI company")));
});
