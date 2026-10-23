import { test } from "node:test";
import assert from "node:assert/strict";
import { npmShimTarget, runShell, findProgram } from "../src/adapters/adapter.ts";
import { classify } from "../src/gate.ts";
import { permissionsFor } from "../src/rules.ts";

const SHIM = `@ECHO off
GOTO start
:find_dp0
SET dp0=%~dp0
EXIT /b
:start
SETLOCAL
CALL :find_dp0
IF EXIST "%dp0%\\node.exe" (
  SET "_prog=%dp0%\\node.exe"
) ELSE (
  SET "_prog=node"
  SET PATHEXT=%PATHEXT:;.JS;=;%
)
endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\node_modules\\@openai\\codex\\bin\\codex.js" %*
`;

test("npm's Windows command wrappers are run through their script", () => {
  assert.equal(npmShimTarget("C:\\Users\\a\\AppData\\Roaming\\npm\\codex.cmd", SHIM),
    "C:\\Users\\a\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\bin\\codex.js");
  assert.equal(npmShimTarget("C:\\x\\tool.cmd", "@echo off\r\ntool.exe %*"), null);
});

test("checks run through the system shell, and programs can be found", async () => {
  assert.equal((await runShell("echo hi && exit 3", { cwd: process.cwd() })).code, 3);
  assert.ok(await findProgram("git"));
  assert.equal(await findProgram("no-such-program-xyz"), null);
});

test("Windows paths into the harness folder are still forbidden", () => {
  const d = classify("Write", { file_path: "C:\\Users\\a\\proj\\.fcrpg\\world.json" }, permissionsFor(4));
  assert.equal(d.allow, false);
  assert.ok(classify("Write", { file_path: "C:\\Users\\a\\proj\\src\\app.ts" }, permissionsFor(1)).allow);
});

test("Claude Code's PowerShell tool follows the same rules as Bash", async () => {
  const { normalizeTool } = await import("../src/hooks.ts");
  assert.equal(normalizeTool("claude", "PowerShell", { command: "Get-ChildItem" }).tool, "Bash");
  const { isReadOnlyCommand } = await import("../src/gate.ts");
  assert.equal(isReadOnlyCommand("Get-Content README.md"), true);
  assert.equal(isReadOnlyCommand("Remove-Item -Recurse src"), false);
});
