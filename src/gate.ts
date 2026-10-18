// The Gatekeeper: a per-tool-call permission check.
//
// CLI flags give coarse control. Claude Code's PreToolUse hook lets us inspect
// every single tool call (tool name + input) before it runs and deny it. The
// claude-code adapter installs `savepoint gate` as that hook and tells it which
// character is acting via SAVEPOINT_CHARACTER. Every denial is logged as a
// violation, which the battle loop turns into a critical failure.
//
// The same classify() function can back gates for other CLIs as they grow hook
// systems. It's pure, so it's easy to test and extend.

import type { Permissions } from "./types.ts";

export type Need = keyof Omit<Permissions, "maxGoldPerBattle">;

const READ_TOOLS = /^(Read|Grep|Glob|LS|TodoWrite|TaskCreate|TaskUpdate|TaskList)$/;
const WRITE_TOOLS = /^(Edit|Write|MultiEdit|NotebookEdit)$/;
const NET_TOOLS = /^(WebFetch|WebSearch)$/;

/** Shell commands that need more than plain `exec`. Order matters: first match wins. */
const COMMAND_RULES: Array<[RegExp, Need, string]> = [
  [/\bgh\s+pr\s+merge\b|\bgit\s+push\b[^\n]*\b(main|master)\b/, "merge", "merging / pushing to the main branch"],
  [/\bgit\s+push\b|\bgh\s+pr\s+create\b/, "openPr", "pushing or opening a PR"],
  [/\b(curl|wget|ssh|scp|nc|npm\s+publish|pip\s+install|npm\s+(i|install)\b)/, "network", "network access"],
];

/** Commands no tier may run. Heroes included. */
const FORBIDDEN: Array<[RegExp, string]> = [
  [/\brm\s+-[a-z]*r[a-z]*f?\s+(\/|~|\$HOME)(\s|$)/, "deleting the filesystem root or home"],
  [/\bgit\s+push\b[^\n]*(--force|-f)\b/, "force-pushing"],
  [/(^|[\s/"'])\.savepoint\//, "touching the harness's own records (character sheets, criteria, Chronicle). Only the harness writes there"],
];

export interface GateDecision { allow: boolean; need?: Need; reason: string }

export function classify(toolName: string, input: Record<string, unknown>, p: Permissions): GateDecision {
  const command = typeof input.command === "string" ? input.command : "";
  const path = String(input.file_path ?? input.path ?? "");

  const isRead = READ_TOOLS.test(toolName);
  for (const [re, why] of FORBIDDEN) {
    if (re.test(command) || (!isRead && re.test(path))) return { allow: false, reason: `Forbidden at every tier: ${why}.` };
  }
  // Read tools may look inside .savepoint/ (lore and scrolls exist to be read). Shell commands
  // touching it are denied outright, so agents read the Chronicle with Read, not `cat`.
  if (isRead) return { allow: true, reason: "read" };
  if (WRITE_TOOLS.test(toolName)) {
    return p.write ? { allow: true, reason: "write" } : { allow: false, need: "write", reason: "Novices may not write files. Propose a diff in your reply instead." };
  }
  if (NET_TOOLS.test(toolName)) {
    return p.network ? { allow: true, reason: "network" } : { allow: false, need: "network", reason: "Network access unlocks at Tier 3." };
  }
  if (toolName === "Bash") {
    if (!p.exec) return { allow: false, need: "exec", reason: "Running commands unlocks at Tier 2." };
    for (const [re, need, why] of COMMAND_RULES) {
      if (re.test(command) && !p[need]) return { allow: false, need, reason: `Not yet permitted: ${why}.` };
    }
    return { allow: true, reason: "exec" };
  }
  if (toolName.startsWith("mcp__")) {
    return p.exec ? { allow: true, reason: "mcp" } : { allow: false, need: "exec", reason: "MCP tools unlock at Tier 2." };
  }
  if (/^(Task|Agent)$/.test(toolName)) {
    return p.recruit ? { allow: true, reason: "summon" } : { allow: false, need: "recruit", reason: "Summoning sub-agents is a Tier 4 (Summoner) power." };
  }
  // Unknown tools: deny by default, so new CLI features don't silently widen access.
  return { allow: false, reason: `Unknown tool ${toolName}; the Gatekeeper denies what it doesn't recognise.` };
}
