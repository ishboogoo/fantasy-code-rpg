import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };

test("fcrpg --version and -v print the package version", () => {
  for (const flag of ["--version", "-v"]) {
    const out = execFileSync(process.execPath, ["src/cli.ts", flag], { encoding: "utf8" }).trim();
    assert.equal(out, `fcrpg ${pkg.version}`);
  }
});
