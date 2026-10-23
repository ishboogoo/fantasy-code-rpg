// Persistence: world state + the Chronicle (shared context).
// Everything is plain files under .savepoint/ so any CLI agent can read it
// with its own file tools, and humans can read it with `cat`.

import { mkdirSync, readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { World } from "./types.ts";

export class Store {
  readonly root: string;

  constructor(projectDir: string) {
    this.root = join(projectDir, ".savepoint");
  }

  get chronicleDir(): string { return join(this.root, "chronicle"); }
  get scrollsDir(): string { return join(this.chronicleDir, "scrolls"); }

  exists(): boolean { return existsSync(join(this.root, "world.json")); }

  init(): void {
    mkdirSync(this.scrollsDir, { recursive: true });
    if (!existsSync(join(this.chronicleDir, "lore.md"))) {
      writeFileSync(join(this.chronicleDir, "lore.md"),
        "# Lore\n\nDurable facts every character should know about this project.\n\n");
    }
    if (!this.exists()) {
      this.save({ version: 1, party: [], enemies: [], treasury: { gold: 5, spent: 0 }, battles: [] });
    }
  }

  load(): World {
    if (!this.exists()) throw new Error("No world here. Run `savepoint init` first.");
    return JSON.parse(readFileSync(join(this.root, "world.json"), "utf8")) as World;
  }

  save(world: World): void {
    mkdirSync(this.root, { recursive: true });
    writeFileSync(join(this.root, "world.json"), JSON.stringify(world, null, 2) + "\n");
  }

  // ---- Chronicle ----

  lore(): string {
    const p = join(this.chronicleDir, "lore.md");
    return existsSync(p) ? readFileSync(p, "utf8") : "";
  }

  addLore(fact: string): void {
    appendFileSync(join(this.chronicleDir, "lore.md"), `- ${fact}\n`);
  }

  scroll(enemyId: string): string {
    const p = join(this.scrollsDir, `${enemyId}.md`);
    return existsSync(p) ? readFileSync(p, "utf8") : "";
  }

  writeScroll(enemyId: string, author: string, text: string): void {
    const p = join(this.scrollsDir, `${enemyId}.md`);
    appendFileSync(p, `\n## ${author} — ${new Date().toISOString()}\n\n${text.trim()}\n`);
  }

  log(event: Record<string, unknown>): void {
    mkdirSync(this.chronicleDir, { recursive: true });
    appendFileSync(join(this.chronicleDir, "log.jsonl"),
      JSON.stringify({ at: new Date().toISOString(), ...event }) + "\n");
  }

  /** Game events for the browser (and anyone else watching): one JSON object per line. */
  get eventsFile(): string { return join(this.chronicleDir, "events.jsonl"); }

  event(e: Record<string, unknown>): void {
    mkdirSync(this.chronicleDir, { recursive: true });
    appendFileSync(this.eventsFile, JSON.stringify({ at: new Date().toISOString(), ...e }) + "\n");
  }

  recordViolation(characterId: string, tool: string, reason: string): void {
    mkdirSync(this.chronicleDir, { recursive: true });
    appendFileSync(join(this.chronicleDir, "violations.jsonl"),
      JSON.stringify({ at: new Date().toISOString(), characterId, tool, reason }) + "\n");
  }

  violationCount(characterId: string): number {
    const p = join(this.chronicleDir, "violations.jsonl");
    if (!existsSync(p)) return 0;
    return readFileSync(p, "utf8").split("\n").filter((l) => l.includes(`"characterId":${JSON.stringify(characterId)}`)).length;
  }

  scrollIds(): string[] {
    return existsSync(this.scrollsDir)
      ? readdirSync(this.scrollsDir).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3))
      : [];
  }
}
