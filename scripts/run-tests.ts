// Runs every scripts/*.test.ts file serially, because database suites share one disposable database.
// Without OUTREACH_TEST_DATABASE_URL, database suites are skipped and listed. CI refuses to skip them.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = "scripts";
const filter = process.argv[2];
const files = readdirSync(dir)
  .filter((name) => name.endsWith(".test.ts") && (!filter || name.includes(filter)))
  .sort();
const hasDatabase = Boolean(process.env.OUTREACH_TEST_DATABASE_URL);
if (process.env.CI && !hasDatabase) {
  console.error("CI requires OUTREACH_TEST_DATABASE_URL.");
  process.exit(1);
}

const failed: string[] = [];
const skipped: string[] = [];
let passed = 0;
for (const name of files) {
  const path = join(dir, name);
  if (!hasDatabase && readFileSync(path, "utf8").includes("OUTREACH_TEST_DATABASE_URL")) {
    skipped.push(name);
    continue;
  }
  const run = spawnSync("npx", ["tsx", "--test", path], { encoding: "utf8", timeout: 300_000 });
  if (run.status === 0) {
    passed += 1;
    console.log(`ok    ${name}`);
  } else {
    failed.push(name);
    console.log(`FAIL  ${name}\n${run.stdout}${run.stderr}`);
  }
}

console.log(`\n${passed} files passed, ${failed.length} failed, ${skipped.length} skipped.`);
if (skipped.length) {
  console.log(`Skipped (set OUTREACH_TEST_DATABASE_URL to a disposable database):\n  ${skipped.join("\n  ")}`);
}
if (failed.length) {
  console.log(`Failed:\n  ${failed.join("\n  ")}`);
}
process.exit(failed.length ? 1 : 0);
