// One rulebook, three CLIs. Claude Code, Codex and Gemini CLI each call
// `fcrpg gate --cli <name>` before every tool call and `fcrpg stop-gate
// --cli <name>` when the hero wants to stop. This file translates each CLI's
// tool names and reply formats to and from the single rulebook in gate.ts.
//
// Formats (checked 2026-10-23):
//   Claude Code  PreToolUse → hookSpecificOutput.permissionDecision "deny"; Stop → {"decision":"block","reason"}
//   Codex        PreToolUse → same shape as Claude Code ("ask" is not supported); Stop → {"decision":"block","reason"}
//   Gemini CLI   BeforeTool → {"decision":"deny","reason"}; AfterAgent → {"decision":"deny","reason"} forces a retry

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { classify, type GateDecision } from "./gate.ts";
import { runShell } from "./adapters/adapter.ts";
import type { Enemy, Permissions } from "./types.ts";

export type HookCli = "claude" | "codex" | "gemini";

/** Map each CLI's tool to the Claude Code-style names the rulebook speaks. Unknown tools stay unknown and are denied. */
export function normalizeTool(cli: HookCli, toolName: string, input: Record<string, unknown>): { tool: string; input: Record<string, unknown> } {
  // Claude Code on Windows runs commands through a PowerShell tool as well as Bash; same rules.
  if (cli === "claude") return { tool: toolName === "PowerShell" ? "Bash" : toolName, input };
  if (cli === "codex") {
    if (toolName === "Bash") return { tool: "Bash", input };
    // apply_patch carries the whole patch in `command`; the rulebook treats it as a write, and the
    // forbidden-path rules still see every file path inside the patch.
    if (toolName === "apply_patch") return { tool: "Edit", input: { file_path: String(input.command ?? "") } };
    if (toolName === "update_plan") return { tool: "TodoWrite", input };
    if (toolName === "spawn_agent") return { tool: "Agent", input };
    return { tool: toolName, input }; // mcp__* passes through
  }
  // Gemini CLI
  const path = String(input.file_path ?? input.absolute_path ?? input.path ?? input.dir_path ?? "");
  if (/^(read_file|read_many_files|list_directory|glob|search_file_content|grep|ls)$/.test(toolName)) return { tool: "Read", input: { file_path: path } };
  if (/^(write_file|replace|edit)$/.test(toolName)) return { tool: "Write", input: { file_path: path } };
  if (toolName === "run_shell_command") return { tool: "Bash", input: { command: String(input.command ?? "") } };
  if (/^(web_fetch|google_web_search)$/.test(toolName)) return { tool: "WebFetch", input };
  if (toolName === "save_memory" || toolName === "write_todos") return { tool: "TodoWrite", input };
  if (toolName.startsWith("mcp_")) return { tool: `mcp__${toolName.slice(4)}`, input };
  return { tool: toolName, input };
}

export function decideTool(cli: HookCli, toolName: string, input: Record<string, unknown>, p: Permissions): GateDecision {
  const n = normalizeTool(cli, toolName, input);
  return classify(n.tool, n.input, p);
}

/** What to print to deny a tool call, in each CLI's own words. */
export function denyOutput(cli: HookCli, reason: string): string {
  const text = `🛡️ The Gatekeeper blocks you. ${reason}`;
  if (cli === "gemini") return JSON.stringify({ decision: "deny", reason: text });
  return JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: text } });
}

/**
 * What to print when you allowed a tool call once in Wait mode. An explicit "allow" (not silence) is needed,
 * because the CLI's own tool list for a lower rank would otherwise still refuse the call.
 */
export function allowOutput(cli: HookCli, reason: string): string {
  const text = `The Guild Master allowed this once. ${reason}`;
  if (cli === "gemini") return JSON.stringify({ decision: "allow", reason: text });
  return JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", permissionDecisionReason: text } });
}

/** What to print to refuse a stop and keep the hero working. */
export function keepGoingOutput(cli: HookCli, reason: string): string {
  return JSON.stringify(cli === "gemini" ? { decision: "deny", reason } : { decision: "block", reason });
}

// ---------- No proof, no victory ----------

export const MAX_PUSHES = 3;

/**
 * When a hero tries to stop, run the quest's command checks. If any still fail, refuse the stop and
 * hand back what failed, up to MAX_PUSHES times per hero per quest so a stuck hero can't loop forever
 * (after that the judge and the Treasure Vault take over).
 */
export async function stopGate(opts: { home: string; quest: Enemy; characterId: string; cwd: string; alreadyPushed?: boolean; only?: string[] }):
  Promise<{ keepGoing: boolean; reason: string }> {
  // In a Siege, a hero is only held to the checks of their own part.
  const checks = opts.quest.criteria.filter((k) => k.check && !k.met && (!opts.only || opts.only.includes(k.id)));
  if (!checks.length) return { keepGoing: false, reason: "No command checks to run." };
  const dir = join(opts.home, "hooks");
  mkdirSync(dir, { recursive: true });
  const counter = join(dir, `stop-${opts.quest.id}-${opts.characterId}.count`);
  const pushes = existsSync(counter) ? Number(readFileSync(counter, "utf8")) || 0 : 0;
  if (pushes >= MAX_PUSHES) return { keepGoing: false, reason: `Already sent back ${pushes} times; the judges take it from here.` };
  const failed: string[] = [];
  for (const k of checks) {
    const r = await runShell(k.check!, { cwd: opts.cwd, timeoutMs: 10 * 60_000 });
    if (r.code !== 0) failed.push(`- ${k.id}: \`${k.check}\` failed.\n${(r.stdout + r.stderr).trim().split("\n").slice(-15).join("\n")}`);
  }
  if (!failed.length) return { keepGoing: false, reason: "Every check passes." };
  writeFileSync(counter, String(pushes + 1));
  return { keepGoing: true, reason: `The enemy still stands. These checks fail, so the quest isn't done yet:\n${failed.join("\n")}\nFix them, then finish.` };
}

// ---------- Settings writers ----------

export interface HookCommands { gate: string; stop: string }

export function claudeHooks(c: HookCommands): Record<string, unknown> {
  return { hooks: {
    // Long timeouts: in Wait mode the hook holds the hero until you answer (or the ask timeout passes).
    PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: `${c.gate} --cli claude`, timeout: 900 }] }],
    Stop: [{ hooks: [{ type: "command", command: `${c.stop} --cli claude`, timeout: 900 }] }],
  } };
}

export function geminiHooks(c: HookCommands): Record<string, unknown> {
  return { hooks: {
    BeforeTool: [{ matcher: "*", hooks: [{ type: "command", command: `${c.gate} --cli gemini`, timeout: 900_000 }] }],
    AfterAgent: [{ matcher: "*", hooks: [{ type: "command", command: `${c.stop} --cli gemini`, timeout: 900_000 }] }],
  } };
}

/** Codex takes config overrides as TOML values on the command line (`-c key=value`). */
export function codexHookArgs(c: HookCommands): string[] {
  const t = (s: string) => `'${s.replace(/'/g, "")}'`;
  return [
    "-c", `hooks.PreToolUse=[{matcher=".*",hooks=[{type="command",command=${t(`${c.gate} --cli codex`)},timeout=900}]}]`,
    "-c", `hooks.Stop=[{hooks=[{type="command",command=${t(`${c.stop} --cli codex`)},timeout=900}]}]`,
  ];
}

// ---------- Battle animation ----------

/** Every tool call becomes a named move on the battle screen. */
export function moveFor(cli: HookCli, toolName: string, input: Record<string, unknown>): { move: string; target: string } {
  const n = normalizeTool(cli, toolName, input);
  const path = String(n.input.file_path ?? n.input.path ?? n.input.pattern ?? "");
  const short = (s: string) => (s.length > 48 ? "…" + s.slice(-47) : s);
  const cmd = String(n.input.command ?? "");
  if (/^(Read|Grep|Glob|LS)$/.test(n.tool)) return { move: "SCAN", target: short(path.split("\n")[0]) };
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(n.tool)) {
    const file = cli === "codex" ? (path.match(/\*\*\* (?:Update|Add|Delete) File: (.+)/)?.[1] ?? "files") : path;
    return { move: "FORGE", target: short(file) };
  }
  if (n.tool === "Bash") return { move: /\b(test|jest|vitest|pytest|mocha|check|lint|tsc)\b/.test(cmd) ? "TRIAL" : "CAST", target: short(cmd.split("\n")[0]) };
  if (/^(WebFetch|WebSearch)$/.test(n.tool)) return { move: "SCRY", target: short(String(n.input.url ?? n.input.query ?? "")) };
  if (/^(Task|Agent)$/.test(n.tool)) return { move: "SUMMON", target: "a helper" };
  if (n.tool.startsWith("mcp__")) return { move: "INVOKE", target: n.tool.slice(5).replace(/__/g, " · ") };
  return { move: "USE", target: toolName };
}
