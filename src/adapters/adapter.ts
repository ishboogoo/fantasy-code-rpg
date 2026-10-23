// The adapter contract. An adapter turns "a character with these permissions
// should attempt this prompt" into a real CLI process or API call, and reports
// back output + cost. Permissions MUST be enforced here (via CLI sandbox flags,
// tool allowlists, or by refusing), never just stated in the prompt.

import { spawn } from "node:child_process";
import type { AdapterKind, Character, Permissions } from "../types.ts";

export interface AdapterRequest {
  character: Character;
  prompt: string;
  cwd: string;
  permissions: Permissions;
  maxTurns: number;
  /** Gold the adapter may spend on this call. Adapters should stop or refuse above it. */
  goldLimit: number;
  /** Absolute path of the .fcrpg/ folder, for adapters that install hooks. */
  home?: string;
  /** The quest being fought, so the stop hook knows which checks to run. */
  questId?: string;
  /** Siege: the conditions this hero's part covers; the stop gate only checks these. */
  criteria?: string[];
  /** Read-only desk work (Clerk, Scout, Planner, judges): never asks to go beyond reading. */
  desk?: boolean;
}

export interface AdapterResult {
  output: string;
  costGold: number;  // pay-per-token money spent
  costMp: number;    // subscription quota consumed
  turns: number;
  /** Set when the adapter caught the character attempting something above its tier. */
  violation?: string;
  error?: string;
}

export interface Adapter {
  kind: AdapterKind;
  /** Human-readable note on how this adapter enforces tiers. Shown in `fcrpg party`. */
  enforcement: string;
  /** Lowest tier this adapter can safely run at. The battle refuses to start below it. */
  minTier?: number;
  run(req: AdapterRequest): Promise<AdapterResult>;
}

export interface ProcResult { code: number; stdout: string; stderr: string }

/** Run a process without a shell (no injection via prompts), with a timeout. */
export async function runProcess(
  cmd: string, args: string[], opts: { cwd: string; input?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv },
): Promise<ProcResult> {
  const [bin, pre] = process.platform === "win32" ? await resolveWindows(cmd) : [cmd, [] as string[]];
  return spawnAndCollect(bin, [...pre, ...args], opts, false);
}

/**
 * Run a command line through the system shell: /bin/sh on macOS and Linux, cmd.exe on Windows.
 * Only for commands the player wrote (victory-condition checks, guards), never for prompts.
 */
export function runShell(command: string, opts: { cwd: string; input?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv }): Promise<ProcResult> {
  return spawnAndCollect(command, [], opts, true);
}

/** Where a program is installed, or null. */
export async function findProgram(name: string): Promise<string | null> {
  const r = process.platform === "win32"
    ? await spawnAndCollect("where", [name], { cwd: process.cwd(), timeoutMs: 5000 }, false)
    : await runShell(`command -v ${name}`, { cwd: process.cwd(), timeoutMs: 5000 });
  return r.code === 0 ? r.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0] ?? null : null;
}

/**
 * The script an npm-installed Windows command wrapper (`name.cmd`, written by npm's cmd-shim) runs,
 * e.g. codex.cmd → <dir>\node_modules\@openai\codex\bin\codex.js. Null if it isn't such a wrapper.
 */
export function npmShimTarget(cmdFile: string, contents: string): string | null {
  const m = contents.match(/"%(?:~)?dp0%\\?([^"]+?\.(?:js|mjs|cjs))"/i);
  if (!m) return null;
  const dir = cmdFile.replace(/[\\/][^\\/]*$/, "");
  return `${dir}\\${m[1].replace(/\//g, "\\")}`;
}

const resolved = new Map<string, [string, string[]]>();
/** Windows: Node can start .exe programs by name, but not npm's .cmd wrappers; run their script with Node instead. */
async function resolveWindows(cmd: string): Promise<[string, string[]]> {
  if (/[\\/]/.test(cmd) || /\.(exe|com)$/i.test(cmd)) return [cmd, []];
  const hit = resolved.get(cmd);
  if (hit) return hit;
  const r = await spawnAndCollect("where", [cmd], { cwd: process.cwd(), timeoutMs: 5000 }, false);
  const paths = r.code === 0 ? r.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [];
  let out: [string, string[]] = [cmd, []];
  const exe = paths.find((p) => /\.(exe|com)$/i.test(p));
  const shim = paths.find((p) => /\.cmd$/i.test(p));
  if (exe) out = [exe, []];
  else if (shim) {
    const { readFileSync } = await import("node:fs");
    const target = npmShimTarget(shim, readFileSync(shim, "utf8"));
    if (target) out = [process.execPath, [target]];
  }
  resolved.set(cmd, out);
  return out;
}

function spawnAndCollect(
  cmd: string, args: string[], opts: { cwd: string; input?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv }, shell: boolean,
): Promise<ProcResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env ?? process.env, stdio: ["pipe", "pipe", "pipe"], shell, windowsHide: true });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), opts.timeoutMs ?? 15 * 60_000);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => { clearTimeout(timer); resolve({ code: 127, stdout, stderr: String(e) }); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ code: code ?? 1, stdout, stderr }); });
    child.stdin.on("error", () => {}); // the child may exit without reading stdin (EPIPE)
    if (opts.input) child.stdin.write(opts.input);
    child.stdin.end();
  });
}
