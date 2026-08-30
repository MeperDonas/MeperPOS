#!/usr/bin/env node
// Build-size harness for the MeperPOS frontend.
//
// Usage:
//   node scripts/build-size.mjs capture            # build + write build-size.baseline.json
//   node scripts/build-size.mjs diff               # build + compare against baseline (exit 1 on regression)
//   node scripts/build-size.mjs diff --skip-build  # compare against existing .next output
//
// NOTE (deviation from design #403): Next.js 16 no longer emits
// .next/app-build-manifest.json and dropped per-route size columns from the
// build output (verified for both Turbopack and webpack builds). The metric
// used here is the per-route client chunk JS under .next/static/chunks/app/**
// (page + layout chunks per route): the route-level JS surface that code
// splitting changes. Shared vendor chunks are excluded, so the metric is
// stable across unrelated framework chunk hash churn and directly sensitive
// to route code changes.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const frontendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const chunksAppDir = path.join(frontendRoot, ".next", "static", "chunks", "app");
const baselinePath = path.join(frontendRoot, "build-size.baseline.json");
const REGRESSION_THRESHOLD = 0.01; // 1%

function isRouteGroupSegment(segment) {
  return /^\(.*\)$/.test(segment);
}

function routeKeyForDir(rootDir, dir) {
  const relative = path.relative(rootDir, dir);
  if (relative === "") return "/";
  const segments = relative
    .split(path.sep)
    .filter((segment) => !isRouteGroupSegment(segment));
  return `/${segments.join("/")}`;
}

// Pure: walk .next/static/chunks/app and sum per-route client chunk bytes.
export function collectRouteSizes(rootDir) {
  if (!existsSync(rootDir)) {
    throw new Error(
      `Missing ${rootDir}. Run a production build first (node scripts/build-size.mjs capture).`,
    );
  }

  const routes = {};

  const visit = (dir) => {
    const routeKey = routeKeyForDir(rootDir, dir);
    routes[routeKey] ??= { bytes: 0, files: [] };

    for (const entry of readdirSync(dir, { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        routes[routeKey].bytes += statSync(entryPath).size;
        routes[routeKey].files.push(entry.name);
      }
    }
  };

  visit(rootDir);
  return routes;
}

// Pure: compare current route sizes against the baseline.
export function diffRouteSizes(baselineRoutes, currentRoutes, threshold = REGRESSION_THRESHOLD) {
  const regressions = [];
  const improvements = [];

  for (const [route, baseline] of Object.entries(baselineRoutes)) {
    const current = currentRoutes[route];
    if (!current) continue;

    const deltaPct = Math.round(
      ((current.bytes - baseline.bytes) / baseline.bytes) * 10000,
    ) / 100;

    if (current.bytes > baseline.bytes * (1 + threshold)) {
      regressions.push({ route, baselineBytes: baseline.bytes, currentBytes: current.bytes, deltaPct });
    } else if (current.bytes < baseline.bytes) {
      improvements.push({ route, baselineBytes: baseline.bytes, currentBytes: current.bytes, deltaPct });
    }
  }

  return { regressions, improvements };
}

function runProductionBuild() {
  const nextBin = path.join(frontendRoot, "node_modules", "next", "dist", "bin", "next");
  console.log("> node next build --webpack");
  const result = spawnSync(process.execPath, [nextBin, "build", "--webpack"], {
    stdio: "inherit",
    cwd: frontendRoot,
  });
  if (result.status !== 0) {
    console.error("Build failed; refusing to capture or diff stale output.");
    process.exit(result.status ?? 1);
  }
}

function readNextVersion() {
  const nextPkg = JSON.parse(
    readFileSync(path.join(frontendRoot, "node_modules", "next", "package.json"), "utf8"),
  );
  return nextPkg.version;
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

function capture() {
  runProductionBuild();
  const routes = collectRouteSizes(chunksAppDir);
  const baseline = {
    generatedAt: new Date().toISOString(),
    bundler: "webpack",
    nextVersion: readNextVersion(),
    metric: "per-route client chunk bytes from .next/static/chunks/app (see file header)",
    routes,
  };
  writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);

  const total = Object.values(routes).reduce((sum, r) => sum + r.bytes, 0);
  console.log(`Captured baseline for ${Object.keys(routes).length} routes (${formatBytes(total)} total) -> ${path.basename(baselinePath)}`);
}

function diff(skipBuild) {
  if (!existsSync(baselinePath)) {
    console.error(`No baseline found at ${baselinePath}. Run "node scripts/build-size.mjs capture" first.`);
    process.exit(1);
  }

  if (!skipBuild) {
    runProductionBuild();
  }

  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  const currentRoutes = collectRouteSizes(chunksAppDir);
  const { regressions, improvements } = diffRouteSizes(baseline.routes, currentRoutes);

  console.log("\nRoute chunk size diff vs baseline:");
  for (const { route, baselineBytes, currentBytes, deltaPct } of improvements) {
    console.log(
      `  ↓ ${route}: ${formatBytes(baselineBytes)} -> ${formatBytes(currentBytes)} (${deltaPct}%)`,
    );
  }
  for (const { route, baselineBytes, currentBytes, deltaPct } of regressions) {
    console.log(
      `  ↑ ${route}: ${formatBytes(baselineBytes)} -> ${formatBytes(currentBytes)} (+${deltaPct}%)`,
    );
  }

  if (regressions.length > 0) {
    console.error(`\nFAIL: ${regressions.length} route(s) regressed beyond ${REGRESSION_THRESHOLD * 100}%.`);
    process.exit(1);
  }

  console.log("\nOK: no route regressed beyond the 1% threshold.");
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  const command = process.argv[2];
  const skipBuild = process.argv.includes("--skip-build");

  if (command === "capture") {
    capture();
  } else if (command === "diff") {
    diff(skipBuild);
  } else {
    console.error("Usage: node scripts/build-size.mjs <capture|diff> [--skip-build]");
    process.exit(1);
  }
}
