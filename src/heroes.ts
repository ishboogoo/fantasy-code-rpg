// Hero cards and travelling heroes.
//
// A hero's card shows off their career: level, rank, trust, wins by kind of quest, the skills they
// learned and links to the real commits behind it all. The same data, as a `.hero.json` file or
// hidden inside the card's PNG, lets someone recruit that hero into their own project.
//
// A hero from another guild arrives as a veteran on probation: their level, title, career and
// skills come along, but their rank here starts at 1 at most (they may change files and must ask
// for more). Their record elsewhere counts as a discounted head start toward promotion, so a
// proven hero earns full rank faster than a newcomer, but always by winning here.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Career, Character, JobLine, ProofEntry, QuestType, Tier, TrackRecord, World } from "./types.ts";
import { JOB_TITLES, recordFor, reliability, title } from "./rules.ts";

export const HERO_FORMAT = "fantasy-code-rpg/hero";
export const MAX_SKILLS = 10;
export const MAX_PROOF = 30;
/** How much a record from another guild counts here, and the most battles it can be worth. */
export const PRIOR_WEIGHT = 0.25;
export const PRIOR_MAX_BATTLES = 10;
/** The highest rank a hero from another guild starts at. */
export const VETERAN_START_TIER: Tier = 1;
const JOBS = Object.keys(JOB_TITLES) as JobLine[];
const QUEST_TYPES: QuestType[] = ["build", "fix", "improve", "explore", "maintain", "write"];
const RACES = ["human", "elf", "dwarf", "beastkin", "lizardfolk", "demonkin", "automaton", "fae"];

export interface HeroFile {
  format: typeof HERO_FORMAT;
  version: 1;
  exportedAt: string;
  hero: { name: string; job: JobLine; look: { race?: string; build?: "feminine" | "masculine" }; level: number; totalXp: number; title: string; adapter?: string };
  career: Career;
  skills: string[];
  proof: ProofEntry[];
}

// ---------- Skills and proof, earned in this guild ----------

/** Plain, single-line, length-limited text; nothing that could smuggle structure into a prompt. */
export function cleanLine(s: unknown, max = 200): string {
  return String(s ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Add skills a hero learned; newest last, no duplicates, at most MAX_SKILLS. */
export function addSkills(c: Character, skills: string[]): string[] {
  const added: string[] = [];
  const have = new Set((c.skills ?? []).map((x) => x.toLowerCase()));
  for (const raw of skills) {
    const s = cleanLine(raw);
    if (!s || have.has(s.toLowerCase())) continue;
    have.add(s.toLowerCase()); added.push(s);
  }
  c.skills = [...(c.skills ?? []), ...added].slice(-MAX_SKILLS);
  return added;
}

/** A repository address safe to show: https only, no user name or token in it. */
export function publicRepo(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const ssh = url.trim().match(/^git@([^:]+):(.+?)(\.git)?$/);
  const u = ssh ? `https://${ssh[1]}/${ssh[2]}` : url.trim().replace(/\.git$/, "");
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "https:") return undefined;
    return `https://${parsed.host}${parsed.pathname}`;
  } catch { return undefined; }
}

/** Record kept work on the heroes who did it. */
export function addProof(heroes: Character[], entry: ProofEntry): void {
  const e = { quest: cleanLine(entry.quest, 80), commit: entry.commit, repo: publicRepo(entry.repo), at: entry.at };
  for (const c of heroes) c.proof = [...(c.proof ?? []), e].slice(-MAX_PROOF);
}

// ---------- Career ----------

/** This guild's part of a hero's career, from the battles they fought here. */
export function localCareer(world: World, c: Character): Career {
  const byType: Career["byType"] = {};
  let wins = 0, losses = 0, battles = 0;
  for (const b of world.battles) {
    if (!b.party.some((p) => p.characterId === c.id)) continue;
    if (b.review === "undone" || b.verdict.outcome === "critical" || b.verdict.outcome === "defeat") {
      losses++; battles++;
      const t = b.questType; if (t) (byType[t] ??= { won: 0, lost: 0 }).lost++;
    } else if (b.verdict.outcome === "victory" && b.review !== "pending") {
      wins++; battles++;
      const t = b.questType; if (t) (byType[t] ??= { won: 0, lost: 0 }).won++;
    }
  }
  return { battles, wins, losses, bestTier: c.tier, byType, guilds: 1 };
}

/** The whole career: this guild plus everything the hero brought with them. */
export function career(world: World, c: Character): Career {
  const here = localCareer(world, c), there = c.veteran?.career;
  if (!there) return here;
  const byType: Career["byType"] = { ...there.byType };
  for (const [t, v] of Object.entries(here.byType) as Array<[QuestType, { won: number; lost: number }]>) {
    const prev = byType[t] ?? { won: 0, lost: 0 };
    byType[t] = { won: prev.won + v.won, lost: prev.lost + v.lost };
  }
  return {
    battles: here.battles + there.battles, wins: here.wins + there.wins, losses: here.losses + there.losses,
    bestTier: Math.max(here.bestTier, there.bestTier) as Tier, byType, guilds: there.guilds + 1,
  };
}

// ---------- Export ----------

export function exportHero(world: World, c: Character, version = ""): HeroFile {
  void version;
  return {
    format: HERO_FORMAT, version: 1, exportedAt: new Date().toISOString(),
    hero: { name: c.name, job: c.job, look: { ...(c.look ?? {}) }, level: c.level, totalXp: c.totalXp, title: title(c), adapter: c.adapter },
    career: career(world, c),
    skills: [...(c.skills ?? [])],
    proof: [...(c.proof ?? [])],
  };
}

// ---------- Import ----------

function num(v: unknown, lo: number, hi: number): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
}

/**
 * Read a hero file someone shared, strictly. Anything unexpected is dropped or clamped; text is
 * flattened to single short lines. Throws if it isn't a hero file at all.
 */
export function parseHeroFile(data: unknown): HeroFile {
  const d = data as Partial<HeroFile> | null;
  if (!d || d.format !== HERO_FORMAT || d.version !== 1 || !d.hero) throw new Error("That isn't a Fantasy Code RPG hero file.");
  const h = d.hero as Partial<HeroFile["hero"]>;
  const name = cleanLine(h.name, 30);
  if (!name) throw new Error("The hero file has no name.");
  const job = JOBS.includes(h.job as JobLine) ? h.job as JobLine : "fighter";
  const look: HeroFile["hero"]["look"] = {};
  if (RACES.includes(String(h.look?.race))) look.race = String(h.look!.race);
  if (h.look?.build === "feminine" || h.look?.build === "masculine") look.build = h.look.build;
  const c = (d.career ?? {}) as Partial<Career>;
  const byType: Career["byType"] = {};
  for (const t of QUEST_TYPES) {
    const v = c.byType?.[t];
    if (v) byType[t] = { won: num(v.won, 0, 100000), lost: num(v.lost, 0, 100000) };
  }
  const wins = num(c.wins, 0, 100000), losses = num(c.losses, 0, 100000);
  return {
    format: HERO_FORMAT, version: 1, exportedAt: cleanLine(d.exportedAt, 40),
    hero: { name, job, look, level: num(h.level, 1, 99), totalXp: num(h.totalXp, 0, 1e9), title: cleanLine(h.title, 30), adapter: cleanLine(h.adapter, 30) || undefined },
    career: { battles: Math.max(num(c.battles, 0, 200000), wins + losses), wins, losses, bestTier: num(c.bestTier, 0, 4) as Tier, byType, guilds: num(c.guilds, 1, 1000) },
    skills: (Array.isArray(d.skills) ? d.skills : []).map((s) => cleanLine(s)).filter(Boolean).slice(0, MAX_SKILLS),
    proof: (Array.isArray(d.proof) ? d.proof : []).slice(0, MAX_PROOF).flatMap((p) => {
      const commit = String((p as ProofEntry)?.commit ?? "");
      if (!/^[0-9a-f]{7,40}$/i.test(commit)) return [];
      return [{ quest: cleanLine((p as ProofEntry).quest, 80), commit, repo: publicRepo((p as ProofEntry).repo), at: cleanLine((p as ProofEntry).at, 40) }];
    }),
  };
}

/** The head start a career elsewhere gives toward promotion here: discounted, and capped. */
export function priorFrom(c: Career): TrackRecord {
  const battles = Math.min(PRIOR_MAX_BATTLES, c.battles * PRIOR_WEIGHT);
  const scale = c.battles > 0 ? battles / c.battles : 0;
  return { successes: +(c.wins * scale).toFixed(2), failures: +(c.losses * scale).toFixed(2), battles: Math.floor(battles) };
}

/** Recruit a hero from a shared file as a veteran on probation. Runs on this guild's own AI connection. */
export function importHero(world: World, file: HeroFile, adapter: Character["adapter"], now = new Date()): Character {
  let name = file.hero.name, n = 2;
  while (world.party.some((c) => c.name.toLowerCase() === name.toLowerCase())) name = `${file.hero.name} ${n++}`;
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `hero-${world.party.length + 1}`;
  const c: Character = {
    id: world.party.some((x) => x.id === id) ? `${id}-${Date.now().toString(36)}` : id,
    name, adapter, job: file.hero.job,
    tier: Math.min(VETERAN_START_TIER, file.career.bestTier) as Tier,
    level: file.hero.level, xp: 0, totalXp: file.hero.totalXp,
    records: {}, status: [], recruitedAt: now.toISOString(),
    look: file.hero.look,
    skills: file.skills.slice(0, MAX_SKILLS),
    proof: file.proof.slice(-MAX_PROOF),
    veteran: { career: file.career, prior: priorFrom(file.career), importedAt: now.toISOString() },
  };
  world.party.push(c);
  return c;
}

/** One-paragraph plain-text summary of a hero file, for the player to check before recruiting. */
export function describeHeroFile(f: HeroFile): string[] {
  const c = f.career;
  const rel = reliability({ successes: c.wins, failures: c.losses, battles: c.battles });
  return [
    `${f.hero.name} · ${f.hero.title || f.hero.job} · Lv ${f.hero.level}`,
    `Career: ${c.wins} won, ${c.losses} lost in ${c.guilds} guild(s) · trust ${(rel * 100).toFixed(0)}% · best rank ${c.bestTier}`,
    `Arrives here at rank ${Math.min(VETERAN_START_TIER, c.bestTier)} (on probation), with a head start worth ${priorFrom(c).battles} battle(s).`,
    ...(f.skills.length ? ["Skills they bring (shown to them as suggestions, never as rules):", ...f.skills.map((s) => `  • ${s}`)] : ["No skills yet."]),
    `${f.proof.length} piece(s) of kept work on record.`,
  ];
}

// ---------- Hero data inside a card PNG ----------

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const PNG_KEY = "fcrpg-hero";
/** A hero file is a few KB; anything far bigger is refused before parsing. */
export const MAX_HERO_TEXT = 256 * 1024;

/** Find the hero data a card PNG carries (a tEXt chunk "fcrpg-hero" holding base64 JSON). */
export function heroFromPng(buf: Buffer): unknown {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIG)) throw new Error("That isn't a PNG image.");
  let at = 8;
  while (at + 8 <= buf.length) {
    const len = buf.readUInt32BE(at), type = buf.toString("latin1", at + 4, at + 8);
    const body = buf.subarray(at + 8, at + 8 + len);
    // Only the plain tEXt chunk our cards write: compressed chunks could expand without limit.
    if (type === "tEXt") {
      const z = body.indexOf(0);
      if (z > 0 && body.toString("latin1", 0, z) === PNG_KEY) {
        if (body.length > MAX_HERO_TEXT) throw new Error("The hero data in this card is too large.");
        return JSON.parse(Buffer.from(body.subarray(z + 1).toString("latin1"), "base64").toString("utf8"));
      }
    }
    if (type === "IEND") break;
    at += 12 + len;
  }
  throw new Error("This picture doesn't carry a hero. Use a card made with Share card in the Tavern.");
}

/** Read a shared hero from a .hero.json text or a card PNG. */
export function readHero(buf: Buffer): HeroFile {
  if (buf.length > 3 * 1024 * 1024) throw new Error("That file is too large to be a hero card.");
  const looksPng = buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIG);
  return parseHeroFile(looksPng ? heroFromPng(buf) : JSON.parse(buf.toString("utf8")));
}

// ---------- Card art ----------

export const MAX_ART_BYTES = 2 * 1024 * 1024;

/** Store a hero's card art in .fcrpg/art/. PNG, JPEG, GIF or WebP, up to 2 MB. Returns the file name. */
export function saveArt(home: string, heroId: string, buf: Buffer): string {
  if (buf.length > MAX_ART_BYTES) throw new Error("That image is over 2 MB. Try a smaller one.");
  const ext = buf.subarray(0, 8).equals(PNG_SIG) ? "png"
    : buf[0] === 0xff && buf[1] === 0xd8 ? "jpg"
    : buf.toString("latin1", 0, 3) === "GIF" ? "gif"
    : buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP" ? "webp" : "";
  if (!ext) throw new Error("Card art must be a PNG, JPEG, GIF or WebP image.");
  const dir = join(home, "art");
  mkdirSync(dir, { recursive: true });
  const name = `${heroId.replace(/[^a-z0-9-]/gi, "")}.${ext}`;
  writeFileSync(join(dir, name), buf);
  return name;
}
