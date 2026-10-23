// The Tavern's paperwork: making a new hero.

import { ADAPTERS } from "./adapters/index.ts";
import { JOB_TITLES } from "./rules.ts";
import type { AdapterKind, Character, JobLine, World } from "./types.ts";

export function newCharacter(name: string, adapter: AdapterKind, job: JobLine, extra: Partial<Character> = {}): Character {
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "hero", name, adapter, job,
    tier: 0, level: 1, xp: 0, totalXp: 0, records: {}, status: [], recruitedAt: new Date().toISOString(), ...extra,
  };
}

/** Add a hero to the guild, with the checks every way of recruiting shares. */
export function recruit(world: World, name: string, adapter: AdapterKind, job: JobLine, extra: Partial<Character> = {}): Character {
  if (!name.trim() || name.length > 24) throw new Error("A hero needs a name of 1 to 24 characters.");
  if (!ADAPTERS[adapter]) throw new Error(`Unknown AI connection ${adapter}. Choose one of: ${Object.keys(ADAPTERS).join(", ")}.`);
  if (!JOB_TITLES[job]) throw new Error(`Unknown job ${job}. Choose one of: ${Object.keys(JOB_TITLES).join(", ")}.`);
  const c = newCharacter(name.trim(), adapter, job, extra);
  if (world.party.some((x) => x.id === c.id)) throw new Error(`${c.name} is already in the guild.`);
  world.party.push(c);
  return c;
}
