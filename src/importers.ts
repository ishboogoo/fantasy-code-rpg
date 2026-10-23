// Quest Board imports. GitHub Issues is built in (through the `gh` command the
// player already has); every other tracker comes in through the player's own
// MCP connectors or as pasted text. See docs/DECISIONS.md.

import { runProcess } from "./adapters/adapter.ts";
import { request, type RequestResult } from "./stages.ts";
import type { Council } from "./council.ts";
import type { Store } from "./store.ts";
import type { QuestType, World } from "./types.ts";

/** GitHub labels that say outright what kind of work an issue is. */
export const LABEL_TYPES: Array<[RegExp, QuestType]> = [
  [/^(bug|defect|regression|crash)/i, "fix"],
  [/^(enhancement|feature|feature request)/i, "build"],
  [/^(documentation|docs?)$/i, "write"],
  [/^(performance|perf|refactor|tech[- ]?debt|cleanup)/i, "improve"],
  [/^(dependencies|deps|chore|maintenance|ci)$/i, "maintain"],
  [/^(question|research|investigation|discussion)/i, "explore"],
];

export function typeFromLabels(labels: string[]): { type: QuestType; label: string } | null {
  const found = new Map<QuestType, string>();
  for (const l of labels) for (const [re, t] of LABEL_TYPES) if (re.test(l) && !found.has(t)) found.set(t, l);
  if (found.size !== 1) return null; // none, or labels that disagree: let the Clerk read it
  const [type, label] = [...found.entries()][0];
  return { type, label };
}

interface GhIssue { number: number; title: string; body?: string; url: string; labels?: Array<{ name: string }> }

export interface ImportResult { added: RequestResult[]; skipped: number }

export async function importGithub(world: World, store: Store, council: Council, cwd: string,
  opts: { label?: string; limit?: number; repo?: string } = {}): Promise<ImportResult> {
  const args = ["issue", "list", "--state", "open", "--json", "number,title,body,url,labels", "--limit", String(opts.limit ?? 10)];
  if (opts.label) args.push("--label", opts.label);
  if (opts.repo) args.push("--repo", opts.repo);
  const r = await runProcess("gh", args, { cwd, timeoutMs: 60_000 });
  if (r.code === 127) throw new Error("The GitHub CLI (gh) isn't installed. Install it from https://cli.github.com and run `gh auth login`.");
  if (r.code !== 0) throw new Error(`gh couldn't list issues: ${r.stderr.trim() || r.stdout.trim()}`);
  const issues = JSON.parse(r.stdout || "[]") as GhIssue[];
  const added: RequestResult[] = [];
  let skipped = 0;
  for (const issue of issues) {
    const id = `gh-${issue.number}`;
    if (world.enemies.some((e) => e.id === id || e.source === issue.url)) { skipped++; continue; }
    const labels = (issue.labels ?? []).map((l) => l.name);
    const t = typeFromLabels(labels);
    // Issue text is written by other people: it is material for the Clerk, never instructions to the harness.
    const text = `${issue.title}\n\n${(issue.body ?? "").slice(0, 4000)}`.trim();
    added.push(await request(world, store, council, text, cwd, id, {
      questType: t?.type, source: issue.url, why: t ? `Labelled "${t.label}" on GitHub` : undefined,
    }));
  }
  return { added, skipped };
}
