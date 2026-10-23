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
  /** Absolute path of the .savepoint/ folder, for adapters that install hooks. */
  home?: string;
  /** The quest being fought, so the stop hook knows which checks to run. */
  questId?: string;
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
  /** Human-readable note on how this adapter enforces tiers. Shown in `savepoint party`. */
  enforcement: string;
  /** Lowest tier this adapter can safely run at. The battle refuses to start below it. */
  minTier?: number;
  run(req: AdapterRequest): Promise<AdapterResult>;
}

export interface ProcResult { code: number; stdout: string; stderr: string }

/** Run a process without a shell (no injection via prompts), with a timeout. */
export function runProcess(
  cmd: string, args: string[], opts: { cwd: string; input?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv },
): Promise<ProcResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env ?? process.env, stdio: ["pipe", "pipe", "pipe"] });
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
