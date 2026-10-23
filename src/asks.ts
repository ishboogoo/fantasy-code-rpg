// Wait mode. When a hero tries something its rank doesn't allow yet, the
// Gatekeeper doesn't just say no: it pauses that hero and asks you. You can
// allow it once (logged, no effect on trust), deny it (the hero proposes the
// change instead), or hand the job to a hero who is allowed. If nobody answers
// in time, the answer is no. Forbidden actions (deleting your home folder,
// force-pushing, touching the harness's records) are never asked about.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Need } from "./gate.ts";

export type AskDecision = "allow" | "deny" | "handoff";

export interface Ask {
  id: string;
  hero: string;
  quest?: string;
  tool: string;
  move: string;
  target: string;
  need: Need;
  reason: string;
  at: string;
  status: "waiting" | "decided" | "expired";
  decision?: AskDecision;
  /** For a handoff: the hero who takes over. */
  to?: string;
  decidedAt?: string;
}

/** What each permission means, in plain words, for the question you are asked. */
export const NEED_WORDS: Record<Need, string> = {
  read: "read files", write: "change files", exec: "run a command", network: "use the internet",
  openPr: "push code or open a pull request", merge: "merge into the main branch", recruit: "call in helpers",
};

export class AskBook {
  readonly dir: string;
  constructor(chronicleDir: string) { this.dir = join(chronicleDir, "asks"); }

  private file(id: string): string { return join(this.dir, `${id}.json`); }

  private write(a: Ask): void {
    mkdirSync(this.dir, { recursive: true });
    const tmp = this.file(a.id) + ".tmp";
    writeFileSync(tmp, JSON.stringify(a, null, 2));
    renameSync(tmp, this.file(a.id)); // atomic: a reader never sees half a file
  }

  create(a: Omit<Ask, "id" | "at" | "status">): Ask {
    const ask: Ask = { id: randomUUID().slice(0, 6), at: new Date().toISOString(), status: "waiting", ...a };
    this.write(ask);
    return ask;
  }

  get(id: string): Ask | undefined {
    const f = this.file(id);
    return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) as Ask : undefined;
  }

  all(): Ask[] {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(this.dir, f), "utf8")) as Ask)
      .sort((a, b) => a.at.localeCompare(b.at));
  }

  waiting(): Ask[] { return this.all().filter((a) => a.status === "waiting"); }

  decide(id: string, decision: AskDecision, to?: string): Ask {
    const a = this.get(id);
    if (!a) throw new Error(`No question ${id}.`);
    if (a.status !== "waiting") throw new Error(`That question was already ${a.status === "expired" ? "closed: nobody answered in time" : "answered"}.`);
    if (decision === "handoff" && !to) throw new Error("Say which hero should take over.");
    const done: Ask = { ...a, status: "decided", decision, to: decision === "handoff" ? to : undefined, decidedAt: new Date().toISOString() };
    this.write(done);
    return done;
  }

  /** Wait for your answer. No answer in time means no. */
  async wait(id: string, timeoutMs: number, pollMs = 400): Promise<Ask> {
    const end = Date.now() + timeoutMs;
    for (;;) {
      const a = this.get(id);
      if (a && a.status !== "waiting") return a;
      if (Date.now() >= end) {
        const expired: Ask = { ...(a as Ask), status: "expired", decision: "deny", decidedAt: new Date().toISOString() };
        this.write(expired);
        return expired;
      }
      await new Promise((r) => setTimeout(r, pollMs));
    }
  }
}
