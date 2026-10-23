// Instances: every battle runs in a private copy of the project (a git worktree on
// its own branch), so heroes never touch your working folder and parallel battles
// never collide. A save point (commit) is made after each hero's turn, so any step
// can be undone. At the Treasure Vault you keep the result (merge) or undo it (discard).

import { existsSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { basename, join } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { runProcess } from "./adapters/adapter.ts";
import type { InstanceInfo } from "./types.ts";

const GIT_ID = ["-c", "user.name=Fantasy Code RPG", "-c", "user.email=fcrpg@localhost", "-c", "commit.gpgsign=false"];

async function git(cwd: string, ...args: string[]): Promise<{ code: number; out: string; err: string }> {
  const r = await runProcess("git", args, { cwd, timeoutMs: 120_000 });
  return { code: r.code ?? 1, out: r.stdout.trim(), err: r.stderr.trim() };
}

async function must(cwd: string, ...args: string[]): Promise<string> {
  const r = await git(cwd, ...args);
  if (r.code !== 0) throw new Error(`git ${args.filter((a) => !a.startsWith("user.") && a !== "-c").join(" ")} failed: ${r.err || r.out}`);
  return r.out;
}

/** True when `dir` is inside a git repository that has at least one commit. */
export async function canIsolate(dir: string): Promise<boolean> {
  const r = await git(dir, "rev-parse", "--verify", "HEAD");
  return r.code === 0;
}

/** Keep the harness folder out of git without touching the player's .gitignore. */
function excludeHarness(repoRoot: string, gitDir: string): void {
  const p = join(gitDir, "info", "exclude");
  mkdirSync(join(gitDir, "info"), { recursive: true });
  const cur = existsSync(p) ? readFileSync(p, "utf8") : "";
  if (!/^\/?\.fcrpg\/?$/m.test(cur)) appendFileSync(p, `${cur.endsWith("\n") || !cur ? "" : "\n"}.fcrpg/\n`);
  void repoRoot;
}

/**
 * Where instances live: outside your project folder (so your editor and tests never see them)
 * and outside any `.fcrpg/` folder (which the Gatekeeper forbids agents to touch).
 * Override with FCRPG_INSTANCES.
 */
export function instancesHome(repoRoot: string): string {
  const base = process.env.FCRPG_INSTANCES
    ?? join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "fcrpg", "instances");
  const tag = createHash("sha256").update(repoRoot).digest("hex").slice(0, 8);
  return join(base, `${basename(repoRoot)}-${tag}`);
}

export async function createInstance(projectDir: string, battleId: string): Promise<InstanceInfo> {
  const root = await must(projectDir, "rev-parse", "--show-toplevel");
  const gitDir = await must(root, "rev-parse", "--absolute-git-dir");
  excludeHarness(root, gitDir);
  const base = await must(root, "rev-parse", "HEAD");
  const branch = `fcrpg/${battleId}`;
  const home = instancesHome(root);
  const path = join(home, battleId);
  mkdirSync(home, { recursive: true });
  await must(root, "worktree", "add", "-b", branch, path, base);
  return { branch, path, base, savePoints: [] };
}

/** Commit whatever changed since the last save point. Returns the new commit, or null if nothing changed. */
export async function savePoint(inst: InstanceInfo, label: string): Promise<string | null> {
  const status = await must(inst.path, "status", "--porcelain");
  if (!status) return null;
  await must(inst.path, "add", "-A");
  await must(inst.path, ...GIT_ID, "commit", "-q", "-m", `fcrpg: ${label}`);
  const sha = await must(inst.path, "rev-parse", "HEAD");
  inst.savePoints.push(sha);
  return sha;
}

/**
 * Siege: bring a part's work into the main copy. Returns false (and leaves the main copy as it was)
 * when the part's changes clash with what is already there.
 */
export async function mergeInto(inst: InstanceInfo, part: InstanceInfo, label: string): Promise<boolean> {
  if (!part.savePoints.length) return true;
  const m = await git(inst.path, ...GIT_ID, "merge", "--no-ff", "-q", "-m", `fcrpg: ${label}`, part.branch);
  if (m.code !== 0) { await git(inst.path, "merge", "--abort"); return false; }
  inst.savePoints.push(await must(inst.path, "rev-parse", "HEAD"));
  return true;
}

/** Roll the instance back to an earlier save point (or the start). Later work is discarded. */
export async function rollback(inst: InstanceInfo, to: string = inst.base): Promise<void> {
  await must(inst.path, "reset", "-q", "--hard", to);
  await must(inst.path, "clean", "-qfd");
  const i = inst.savePoints.indexOf(to);
  inst.savePoints = i >= 0 ? inst.savePoints.slice(0, i + 1) : [];
}

/** Plain-language summary of what the battle changed, for the Treasure Vault. */
export async function changes(inst: InstanceInfo): Promise<{ files: string[]; stat: string }> {
  const files = (await must(inst.path, "diff", "--name-only", `${inst.base}..HEAD`)).split("\n").filter(Boolean);
  const stat = await must(inst.path, "diff", "--shortstat", `${inst.base}..HEAD`);
  return { files, stat };
}

/**
 * Keep: bring the battle's changes into your project. Uses a fast-forward when your branch
 * hasn't moved, otherwise a merge commit. Refuses if your working folder has uncommitted
 * changes to the same files, so nothing of yours is ever overwritten.
 */
export async function keep(projectDir: string, inst: InstanceInfo): Promise<string> {
  const root = await must(projectDir, "rev-parse", "--show-toplevel");
  if (!inst.savePoints.length) { await discard(root, inst); return "Nothing to keep: the battle changed no files."; }
  const ff = await git(root, "merge", "--ff-only", "-q", inst.branch);
  if (ff.code !== 0) {
    const m = await git(root, ...GIT_ID, "merge", "--no-ff", "-q", "-m", `Keep ${inst.branch}`, inst.branch);
    if (m.code !== 0) {
      await git(root, "merge", "--abort");
      throw new Error(`Couldn't bring the changes in automatically: ${m.err || m.out}. Your project is unchanged; the battle's work is still on branch ${inst.branch}.`);
    }
  }
  await discard(root, inst, false);
  return `Kept: ${inst.savePoints.length} save point(s) merged from ${inst.branch}.`;
}

/** Undo: throw the battle's copy away. Your project never saw the changes. */
export async function discard(projectDir: string, inst: InstanceInfo, deleteBranch = true): Promise<void> {
  const root = await must(projectDir, "rev-parse", "--show-toplevel");
  await git(root, "worktree", "remove", "--force", inst.path);
  await git(root, "worktree", "prune");
  await git(root, "branch", deleteBranch ? "-D" : "-d", inst.branch);
}
