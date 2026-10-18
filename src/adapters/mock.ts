// A simulated character for demos and tests. No keys, no CLIs, no cost.
// adapterConfig.skill (0..1) sets how often it succeeds; adapterConfig.seed
// makes runs reproducible.

import type { Adapter, AdapterResult } from "./adapter.ts";

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

    // Judging request: confirm the DONE lines found in the scroll.
    if (req.prompt.includes("[JUDGE]")) {
      const done = [...req.prompt.matchAll(/^DONE: (\S+)/gm)].map((m) => m[1]);
      const quality = Math.min(1, Math.max(0, skill * 0.6 + rand() * 0.4));
      return { output: JSON.stringify({ met: [...new Set(done)], quality, notes: "Mock review." }), costGold, costMp: 0, turns: 1 };
    }

    // Occasional overreach, more likely for low-skill characters.
    if (rand() < (1 - skill) * 0.08) {
      return { output: "Tried to force-push to main.", costGold, costMp: 1, turns, violation: "attempted an action above its tier" };
    }

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
