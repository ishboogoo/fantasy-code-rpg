// Gold (API spend) and MP (subscription quota) bookkeeping.

import type { Character, World } from "./types.ts";

/** Refill MP if the character's refill window has passed. Mutates. */
export function refillMp(c: Character, now = new Date()): void {
  if (!c.mp) return;
  const elapsedH = (now.getTime() - new Date(c.mp.lastRefill).getTime()) / 3_600_000;
  if (elapsedH >= c.mp.refillHours) {
    c.mp.current = c.mp.max;
    c.mp.lastRefill = now.toISOString();
    c.status = c.status.filter((s) => s !== "resting");
  }
}

export function canAfford(world: World, c: Character, gold: number, mp: number): string | null {
  if (gold > 0 && world.treasury.gold - world.treasury.spent < gold) return "The treasury is empty.";
  if (mp > 0 && c.mp && c.mp.current < mp) return `${c.name} is out of MP. Rest at the Inn.`;
  return null;
}

export function spend(world: World, c: Character, gold: number, mp: number): void {
  world.treasury.spent = +(world.treasury.spent + gold).toFixed(6);
  if (c.mp && mp > 0) {
    c.mp.current = Math.max(0, c.mp.current - mp);
    if (c.mp.current === 0 && !c.status.includes("resting")) c.status.push("resting");
  }
}

export function goldLeft(world: World): number {
  return +(world.treasury.gold - world.treasury.spent).toFixed(4);
}
