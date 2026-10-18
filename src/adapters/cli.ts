// Adapters for subscription coding CLIs. Each maps SAVEPOINT tiers onto the
// CLI's own sandbox / permission flags.
//
// ⚠️  CLI flags change often. Every mapping below is marked VERIFY and is a
// great first contribution: check it against the CLI's current --help and
// add a test. See ROADMAP.md → "Good first quests".

import type { Adapter, AdapterRequest, AdapterResult } from "./adapter.ts";
import { runProcess } from "./adapter.ts";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CLI_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "cli.ts");

/** Write a Claude Code settings file that routes every tool call through `savepoint gate`. */
function gateSettings(home: string): string {
  const dir = join(home, "hooks");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "claude-settings.json");
  const command = `node ${JSON.stringify(CLI_PATH)} gate`;
  writeFileSync(path, JSON.stringify({
    hooks: { PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command }] }] },
  }, null, 2));
  return path;
}

function billing(req: AdapterRequest): "subscription" | "api" {
  return req.character.adapterConfig?.billing === "api" ? "api" : "subscription";
}

/** Claude Code in headless mode. */
export const claudeCode: Adapter = {
  kind: "claude-code",
  enforcement: "Per-tool-call Gatekeeper hook + tool allowlist per tier (most precise adapter)",
  async run(req) {
    const p = req.permissions;
    const tools = ["Read", "Grep", "Glob"];
    if (p.write) tools.push("Edit", "Write");
    if (p.exec) tools.push("Bash");
    if (p.network) tools.push("WebFetch", "WebSearch");
    // VERIFY: flag names against `claude --help`.
    const args = ["-p", req.prompt, "--output-format", "json", "--max-turns", String(req.maxTurns)];
    if (!p.write) args.push("--permission-mode", "plan");
    args.push("--allowedTools", tools.join(","));
    if (req.character.model) args.push("--model", req.character.model);
    // Fine-grained enforcement: every tool call is checked by the Gatekeeper hook.
    // VERIFY: `--settings <file>` merges hooks on your Claude Code version.
    if (req.home) args.push("--settings", gateSettings(req.home));
    const env = { ...process.env, SAVEPOINT_CHARACTER: req.character.id, SAVEPOINT_HOME: req.home ?? "" };

    const r = await runProcess("claude", args, { cwd: req.cwd, env });
    if (r.code !== 0 && !r.stdout) return fail(`claude exited ${r.code}: ${r.stderr.slice(0, 400)}`);
    try {
      const j = JSON.parse(r.stdout) as { result?: string; total_cost_usd?: number; num_turns?: number; is_error?: boolean };
      const turns = j.num_turns ?? 1;
      const cost = j.total_cost_usd ?? 0;
      return billing(req) === "api"
        ? { output: j.result ?? "", costGold: cost, costMp: 0, turns, error: j.is_error ? "claude reported an error" : undefined }
        : { output: j.result ?? "", costGold: 0, costMp: turns, turns, error: j.is_error ? "claude reported an error" : undefined };
    } catch {
      return { output: r.stdout, costGold: 0, costMp: 1, turns: 1 };
    }
  },
};

/** OpenAI Codex CLI, non-interactive. */
export const codex: Adapter = {
  kind: "codex",
  enforcement: "T0 read-only sandbox · T1–T2 workspace-write sandbox · T3+ workspace-write + network (coarse: T1 can still run commands)",
  async run(req) {
    const p = req.permissions;
    // VERIFY: sandbox names and the network config key against `codex exec --help`.
    const sandbox = p.write ? "workspace-write" : "read-only";
    const args = ["exec", "--sandbox", sandbox];
    if (p.network) args.push("-c", "sandbox_workspace_write.network_access=true");
    if (req.character.model) args.push("--model", req.character.model);
    args.push(req.prompt);
    const r = await runProcess("codex", args, { cwd: req.cwd });
    if (r.code !== 0) return fail(`codex exited ${r.code}: ${r.stderr.slice(0, 400)}`);
    // Codex doesn't report cost here; count one MP per call. Better estimators welcome.
    return { output: r.stdout, costGold: 0, costMp: 1, turns: 1 };
  },
};

/** Google Gemini CLI, non-interactive. */
export const geminiCli: Adapter = {
  kind: "gemini-cli",
  enforcement: "T0 default approval (tools denied headless) · T1 auto_edit · T2+ yolo inside --sandbox",
  async run(req) {
    const p = req.permissions;
    // VERIFY: --approval-mode values and --sandbox against `gemini --help`.
    const mode = p.exec ? "yolo" : p.write ? "auto_edit" : "default";
    const args = ["-p", req.prompt, "--approval-mode", mode];
    if (p.exec) args.push("--sandbox");
    if (req.character.model) args.push("--model", req.character.model);
    const r = await runProcess("gemini", args, { cwd: req.cwd });
    if (r.code !== 0) return fail(`gemini exited ${r.code}: ${r.stderr.slice(0, 400)}`);
    return { output: r.stdout, costGold: 0, costMp: 1, turns: 1 };
  },
};

/** Any command. The prompt goes to stdin. Only allowed at T2+ because it executes. */
export const shell: Adapter = {
  kind: "shell",
  enforcement: "Only fights at T2+ (it executes an arbitrary command)",
  minTier: 2,
  async run(req) {
    if (!req.permissions.exec) {
      return { output: "", costGold: 0, costMp: 0, turns: 0, violation: "shell adapter requires exec permission (T2+)" };
    }
    const cmd = req.character.adapterConfig?.command;
    if (!cmd) return fail("shell adapter needs adapterConfig.command");
    const r = await runProcess("sh", ["-c", cmd], { cwd: req.cwd, input: req.prompt });
    return { output: r.stdout + r.stderr, costGold: 0, costMp: 0, turns: 1, error: r.code === 0 ? undefined : `exit ${r.code}` };
  },
};

function fail(error: string): AdapterResult {
  return { output: "", costGold: 0, costMp: 0, turns: 0, error };
}
