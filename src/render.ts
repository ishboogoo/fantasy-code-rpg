// 16-bit-flavoured terminal UI: windows, HP bars, status screens.

import { ENEMY_ICON, permissionsFor, recordFor, reliability, title, xpToNext } from "./rules.ts";
import { goldLeft } from "./economy.ts";
import type { BattleReport, Character, Enemy, World } from "./types.ts";

const W = 64;

function strip(s: string): number {
  // Approximate display width: count emoji as 2 columns.
  return [...s].reduce((n, ch) => n + ((ch.codePointAt(0) ?? 0) >= 0x1F000 ? 2 : 1), 0);
}

export function box(titleText: string, lines: string[]): string {
  const top = `╔═ ${titleText} ${"═".repeat(Math.max(0, W - strip(titleText) - 5))}╗`;
  const body = lines.flatMap((l) => (strip(l) > W - 3 ? wrap(l, W - 4) : [l])).map((l) => `║ ${l}${" ".repeat(Math.max(0, W - strip(l) - 3))}║`);
  return [top, ...body, `╚${"═".repeat(W - 2)}╝`].join("\n");
}

export function bar(value: number, max: number, width = 16, full = "█", empty = "░"): string {
  const n = max > 0 ? Math.round((value / max) * width) : 0;
  return full.repeat(Math.max(0, Math.min(width, n))) + empty.repeat(Math.max(0, width - n));
}

export function characterLine(c: Character): string {
  const rel = reliability(recordFor(c));
  const status = c.status.length ? ` [${c.status.join(",")}]` : "";
  return `${c.name.padEnd(10)} Lv${String(c.level).padStart(2)} T${c.tier} ${title(c).padEnd(12)} REL ${rel.toFixed(2)} ${c.adapter}${status}`;
}

export function partyScreen(world: World): string {
  if (!world.party.length) return box("PARTY", ["Nobody here yet. Visit the Tavern: fcrpg recruit <name> …"]);
  const lines: string[] = [];
  for (const c of world.party) {
    lines.push(characterLine(c));
    const p = permissionsFor(c.tier);
    const perms = ["write", "exec", "network", "openPr", "merge", "recruit"].filter((k) => p[k as keyof typeof p]);
    const mp = c.mp ? `  MP ${bar(c.mp.current, c.mp.max, 8)} ${c.mp.current}/${c.mp.max}` : "";
    lines.push(`  EXP ${bar(c.xp, xpToNext(c.level), 12)} ${c.xp}/${xpToNext(c.level)}${mp}`);
    lines.push(`  may: read${perms.length ? ", " + perms.join(", ") : ""}`);
  }
  lines.push("", `💰 Treasury: ${goldLeft(world)} G`);
  return box("PARTY", lines);
}

export function enemyLine(e: Enemy): string {
  const hp = e.criteria.filter((k) => !k.met).length;
  return `${ENEMY_ICON[e.kind]} ${e.id.padEnd(10)} ${e.name.slice(0, 22).padEnd(22)} Lv${String(e.level).padStart(2)} HP ${bar(hp, e.criteria.length, 8)} ${e.status}`;
}

export function enemiesScreen(world: World): string {
  return box("BESTIARY", world.enemies.length ? world.enemies.map(enemyLine) : ["No enemies. Spawn one: fcrpg spawn …"]);
}

export function reportScreen(world: World, r: BattleReport): string {
  const v = r.verdict;
  const banner = { victory: "★ VICTORY ★", retreat: "RETREAT", defeat: "DEFEAT", critical: "!! CRITICAL FAILURE !!" }[v.outcome];
  const lines = [
    `Correctness ${(v.correctness * 100).toFixed(0)}%   Quality ${(v.quality * 100).toFixed(0)}%   Judged by ${v.judgedBy}`,
    `Spent ${r.costGold} G · ${r.costMp} MP · ${r.turns} turns`,
    ...r.party.map((p) => {
      const c = world.party.find((x) => x.id === p.characterId);
      return `  ${c?.name ?? p.characterId} +${r.xpAwarded[p.characterId] ?? 0} EXP`;
    }),
  ];
  if (v.notes) lines.push("", ...wrap(v.notes, W - 4));
  return box(banner, lines);
}

function wrap(s: string, w: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of s.split(/\s+/)) {
    if ((line + " " + word).trim().length > w) { out.push(line); line = word; } else line = (line + " " + word).trim();
  }
  if (line) out.push(line);
  return out;
}
