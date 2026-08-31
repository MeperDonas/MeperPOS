// Build-size harness for the MeperPOS frontend.
//
// Usage:
//   node scripts/build-size.mjs capture            # build + write build-size.baseline.json
//   node scripts/build-size.mjs diff               # build + compare against baseline (exit 1 on regression)
//   node scripts/build-size.mjs diff --skip-build  # compare against existing .next output
//
// NOTE (deviation from design #403): Next.js 16 no longer emits
// .next/app-build-manifest.json and dropped per-route size columns from the
// build output (verified for both Turbopack and webpack builds).
//
// The metric used here approximates Next's classic per-route "First Load JS":
// for every route, the union of client chunks referenced by its
// .next/server/app/<route>/page_client-reference-manifest.js (page chunk,
// shared chunks, layout chunks) plus the root main files and polyfills.
// Chunks referenced by OTHER routes' page modules are excluded, so the number
// is invariant to webpack moving code between shared and route chunks.

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
const serverAppDir = path.join(frontendRoot, ".next", "server", "app");
const rootBuildManifestPath = path.join(frontendRoot, ".next", "build-manifest.json");
const baselinePath = path.join(frontendRoot, "build-size.baseline.json");
const REGRESSION_THRESHOLD = 0.01; // 1%

function toForwardSlashes(value) {
  return value.replaceAll("\\", "/");
}

function isRouteGroupSegment(segment) {
  return /^\(.*\)$/.test(segment);
}

function urlRouteForKey(manifestKey) {
  // Manifest keys look like "/pos/page" or "/settings/(advanced)/advanced/page".
  const segments = manifestKey
    .replace(/\/page$/, "")
    .split("/")
    .filter((segment) => segment !== "" && !isRouteGroupSegment(segment));
  return `/${segments.join("/")}`;
}

// Pure: extract the chunk paths a route's manifest references, excluding
// chunks that belong to other routes' page modules.
export function parseRouteChunkPaths(manifestSource, manifestKey) {
  const start = manifestSource.indexOf('{"moduleLoading"');
  if (start === -1) {
    throw new Error(`Unparseable client reference manifest for ${manifestKey}`);
  }
  const end = manifestSource.lastIndexOf("}") + 1;
  const manifest = JSON.parse(manifestSource.slice(start, end));

  const pageSource = toForwardSlashes(
    `src/app/${manifestKey.replace(/^\//, "").replace(/\/page$/, "")}/page.tsx`,
  );

  const chunks = new Set();
  for (const [sourcePath, moduleEntry] of Object.entries(
    manifest.clientModules ?? {},
  )) {
    const normalized = toForwardSlashes(sourcePath);
    const isPageModule = /\/page\.tsx$/.test(normalized);
    const isOwnPageModule = isPageModule && normalized.endsWith(pageSource);
    if (isPageModule && !isOwnPageModule) continue;

    for (const chunk of moduleEntry?.chunks ?? []) {
      if (typeof chunk === "string" && chunk.startsWith("static/")) {
        chunks.add(chunk);
      }
    }
  }
  return chunks;
}

function readRootSharedChunks(rootManifestPath) {
  if (!existsSync(rootManifestPath)) return [];
  const buildManifest = JSON.parse(readFileSync(rootManifestPath, "utf8"));
  return [
    ...(buildManifest.polyfillFiles ?? []),
    ...(buildManifest.rootMainFiles ?? []),
  ];
}

function sumChunkBytes(chunks, chunkRoot) {
  let bytes = 0;
  for (const chunk of chunks) {
    const filePath = path.join(chunkRoot, chunk);
    if (existsSync(filePath)) bytes += statSync(filePath).size;
  }
  return bytes;
}

// Walk .next/server/app and compute per-route first-load JS bytes.
export function collectRouteSizes(
  serverAppRoot,
  {
    rootManifestPath = rootBuildManifestPath,
    chunkRoot = path.join(frontendRoot, ".next"),
  } = {},
) {
  if (!existsSync(serverAppRoot)) {
    throw new Error(
      `Missing ${serverAppRoot}. Run a production build first (node scripts/build-size.mjs capture).`,
    );
  }

  const routes = {};
  const sharedChunks = new Set(readRootSharedChunks(rootManifestPath));

  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile() && entry.name === "page_client-reference-manifest.js") {
        const manifestSource = readFileSync(entryPath, "utf8");
        const manifestKey =
          /__RSC_MANIFEST\["([^"]+)"\]/.exec(manifestSource)?.[1];
        if (!manifestKey) continue;

        const chunks = parseRouteChunkPaths(manifestSource, manifestKey);
        for (const shared of sharedChunks) chunks.add(shared);
        routes[urlRouteForKey(manifestKey)] = {
          bytes: sumChunkBytes(chunks, chunkRoot),
          files: [...chunks].sort(),
        };
      }
    }
  };

  visit(serverAppRoot);
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
  const routes = collectRouteSizes(serverAppDir);
  const baseline = {
    generatedAt: new Date().toISOString(),
    bundler: "webpack",
    nextVersion: readNextVersion(),
    metric:
      "per-route first-load JS bytes: client chunks from page_client-reference-manifest.js + root main files (see file header)",
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
  const currentRoutes = collectRouteSizes(serverAppDir);
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
