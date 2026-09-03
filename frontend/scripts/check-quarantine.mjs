// Quarantine watchdog for the MeperPOS frontend.
//
// Runs every quarantined suite through a dedicated Vitest config
// (vitest.quarantine.config.ts), which derives its `include` list from the
// typed registry (frontend/quarantine.ts). Any suite that PASSES is a
// candidate for restoration to the blocking surface — emit a non-blocking
// GitHub Actions `::warning::` naming it.
//
// Exit contract (spec R4): always exits 0 for suite outcomes, whether they
// pass or fail. The ONLY non-zero exit is an infrastructure crash (missing
// config, child spawn failure, unreadable report) — surfaced as a `::error::`
// so the watchdog itself cannot silently break. Empty registry => Vitest runs
// zero files (passWithNoTests) => silent exit 0 (D4).
//
// Usage: node scripts/check-quarantine.mjs

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const frontendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const quarantineConfig = path.join(frontendRoot, "vitest.quarantine.config.ts");
const vitestCli = path.join(frontendRoot, "node_modules", "vitest", "vitest.mjs");
const reportPath = path.join(frontendRoot, ".quarantine-report.json");

// Pure: given a Vitest JSON reporter report, return the file paths of suites
// that PASSED. Failed suites are omitted; an empty or missing report yields [].
export function passingSuites(report) {
  if (!report || !Array.isArray(report.testResults)) return [];
  return report.testResults
    .filter((result) => result && result.status === "passed" && result.name)
    .map((result) => result.name);
}

function run() {
  try {
    if (!existsSync(vitestCli)) {
      throw new Error(`Vitest CLI not found at ${vitestCli}`);
    }
    if (existsSync(reportPath)) rmSync(reportPath, { force: true });

    const child = spawnSync(
      process.execPath,
      [
        vitestCli,
        "run",
        "--config",
        quarantineConfig,
        "--reporter=json",
        `--outputFile=${reportPath}`,
      ],
      { cwd: frontendRoot, encoding: "utf8" },
    );

    // Suite failures still write a JSON report, so absence of the report is
    // the infrastructure-crash signal — not the child's exit code (which is
    // non-zero for any failing suite by design of `vitest run`).
    if (!existsSync(reportPath)) {
      throw new Error(
        `Vitest produced no report (exit ${child.status ?? "signal"}): ` +
          `${(child.stderr || "").trim() || (child.stdout || "").trim()}`,
      );
    }

    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    for (const suite of passingSuites(report)) {
      console.warn(`::warning::Quarantined suite ${suite} is PASSING — restore it`);
    }
  } catch (error) {
    console.error(`::error::Quarantine watchdog crashed: ${error.message}`);
    process.exit(1);
  }

  // Suite outcomes never fail the step; only infra crashes do.
  process.exit(0);
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  run();
}
