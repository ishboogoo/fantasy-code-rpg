import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CLI = join(import.meta.dirname, "..", "src", "cli.ts");
const pkg = JSON.parse(readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8")) as {
  version: string;
};

function run(args: string[]): string {
  return execFileSync(process.execPath, [CLI, ...args], { encoding: "utf8" }).trim();
}

test("fcrpg --version prints the package version and exits 0", () => {
  assert.equal(run(["--version"]), `fcrpg ${pkg.version}`);
});

test("fcrpg -v is the short form of --version", () => {
  assert.equal(run(["-v"]), `fcrpg ${pkg.version}`);
});
