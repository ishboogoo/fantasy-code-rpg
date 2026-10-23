// A simulated character for demos and tests. No keys, no CLIs, no cost.
// adapterConfig.skill (0..1) sets how often it succeeds; adapterConfig.seed
// makes runs reproducible.

import type { Adapter, AdapterResult } from "./adapter.ts";
import { appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const MOVES: Array<[string, string]> = [["SCAN", "src/login.ts"], ["SCAN", "test/login.test.ts"], ["FORGE", "src/login.ts"], ["TRIAL", "npm test"], ["FORGE", "src/validate.ts"]];

/** Simulated heroes act out a few moves so the battle screen has something to show. adapterConfig.pace = ms per move. */
async function actOut(home: string | undefined, hero: string, quest: string | undefined, pace: number, rand: () => number): Promise<void> {
  if (!home || !pace || !existsSync(join(home, "chronicle"))) return;
  const n = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    await new Promise((r) => setTimeout(r, pace));
    const [move, target] = MOVES[Math.floor(rand() * MOVES.length)];
    appendFileSync(join(home, "chronicle", "events.jsonl"), JSON.stringify({ at: new Date().toISOString(), type: "action", hero, quest, move, target, allowed: true }) + "\n");
  }
}

function rng(seedStr: string): () => number {
  let h = 2166136261;
  for (const ch of seedStr) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let calls = 0;

export const mock: Adapter = {
  kind: "mock",
  enforcement: "Simulated — pretends to respect tiers, occasionally misbehaves so the curse system has something to catch",
  async run(req): Promise<AdapterResult> {
    const cfg = req.character.adapterConfig ?? {};
    const skill = Number(cfg.skill ?? 0.75);
    const rand = rng(`${cfg.seed ?? "s"}:${req.character.id}:${calls++}`);
    const turns = 1 + Math.floor(rand() * req.maxTurns * 0.6);
    const costGold = +(0.01 * turns * (0.5 + rand())).toFixed(4);

    // Judging request: one verdict per condition, confirming the DONE lines found in the evidence.
    if (req.prompt.includes("[JUDGE]")) {
      const done = new Set([...req.prompt.matchAll(/^DONE: (\S+)/gm)].map((m) => m[1]));
      const ids = [...req.prompt.matchAll(/^\* (\S+):/gm)].map((m) => m[1]);
      const verdicts = Object.fromEntries(ids.map((id) => [id, done.has(id)]));
      const quality = Math.min(1, Math.max(0, skill * 0.6 + rand() * 0.4));
      return { output: JSON.stringify({ verdicts, quality, notes: "Mock review." }), costGold, costMp: 0, turns: 1 };
    }

    // Desk jobs: the Clerk, the Scout and the Planner.
    if (req.prompt.startsWith("[CLERK]")) {
      const text = req.prompt.match(/^Request: (.*)$/m)?.[1] ?? "";
      const words = text.split(/\s+/).filter(Boolean);
      const reply = {
        name: text.slice(0, 40), questType: /fix|bug|crash/i.test(text) ? "fix" : "build", monster: "goblin", level: 2, goldBudget: 1,
        conditions: [{ id: "works", description: `It works: ${text}`, proof: "judge" }, { id: "tests", description: "Existing tests still pass", proof: "command", check: "true" }],
        questions: words.length < 4 ? ["What exactly should happen when this is done?"] : [],
      };
      return { output: JSON.stringify(reply), costGold, costMp: 0, turns: 1 };
    }
    if (req.prompt.startsWith("[SCOUT]")) {
      const verdict = /\bunclear\b/i.test(req.prompt.split("Victory conditions:")[0]) ? "unclear" : /\band also\b/i.test(req.prompt) ? "split" : "proceed";
      const extra = verdict === "unclear" ? "\nQUESTION: Which page do you mean?" : verdict === "split" ? "\nSPLIT: first part\nSPLIT: second part" : "";
      return { output: `Scouting report: the relevant code is in src/.${extra}\nVERDICT: ${verdict}`, costGold, costMp: 0, turns: 1 };
    }
    if (req.prompt.startsWith("[PLAN]")) {
      return { output: "1. Read the code.\n2. Make the change.\n3. Prove each condition.", costGold, costMp: 0, turns: 1 };
    }

    // Occasional overreach, more likely for low-skill characters.
    if (rand() < (1 - skill) * 0.08) {
      return { output: "Tried to force-push to main.", costGold, costMp: 1, turns, violation: "attempted an action above its tier" };
    }

    await actOut(req.home, req.character.id, req.questId, Number(cfg.pace ?? 0), rand);
    const ids = [...req.prompt.matchAll(/^- \[(\w[\w-]*)\]/gm)].map((m) => m[1]);
    const done = ids.filter(() => rand() < skill);
    const lines = done.map((id) => `DONE: ${id}`);
    return {
      output: `${req.character.name} attacks!\n${lines.join("\n") || "The blow misses."}`,
      costGold,
      costMp: req.character.mp ? 1 : 0,
      turns,
    };
  },
};
