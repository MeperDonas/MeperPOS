import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectRouteSizes, diffRouteSizes, parseRouteChunkPaths } from "./build-size.mjs";

function manifestFixture(routeKey, ownPageChunks, otherPageChunks) {
  const routeDir = routeKey.replace(/^\//, "").replace(/\/page$/, "");
  return `globalThis.__RSC_MANIFEST=(globalThis.__RSC_MANIFEST||{});globalThis.__RSC_MANIFEST["${routeKey}"]={"moduleLoading":{"prefix":"/_next/"},"clientModules":{"C:/app/src/app/${routeDir}/page.tsx":{"id":"1","chunks":${JSON.stringify(ownPageChunks)}},"C:/app/src/app/other/page.tsx":{"id":"2","chunks":${JSON.stringify(otherPageChunks)}},"C:/app/src/contexts/AuthContext.tsx":{"id":"3","chunks":["static/chunks/shared-abc.js"]}},"rscModuleMapping":{}}`;
}

describe("build-size harness", () => {
  let tempRoot;

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), "build-size-"));
  });

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  describe("parseRouteChunkPaths", () => {
    it("collects the route's own chunks and shared module chunks", () => {
      const source = manifestFixture("/pos", ["static/chunks/app/pos/page-a.js"], [
        "static/chunks/other-page-chunk.js",
      ]);

      const chunks = parseRouteChunkPaths(source, "/pos/page");

      expect(chunks).toEqual(
        new Set([
          "static/chunks/app/pos/page-a.js",
          "static/chunks/shared-abc.js",
        ]),
      );
    });

    it("excludes chunks referenced only by other routes' page modules", () => {
      const source = manifestFixture("/", [], [
        "static/chunks/other-route-only.js",
      ]);

      const chunks = parseRouteChunkPaths(source, "/page");

      expect(chunks).toEqual(new Set(["static/chunks/shared-abc.js"]));
    });
  });

  describe("collectRouteSizes", () => {
    it("sums manifest chunk bytes plus root main files per URL route", () => {
      const serverApp = join(tempRoot, "server", "app");
      const posDir = join(serverApp, "pos");
      const groupedDir = join(serverApp, "settings", "(advanced)", "advanced");
      mkdirSync(posDir, { recursive: true });
      mkdirSync(groupedDir, { recursive: true });
      writeFileSync(
        join(posDir, "page_client-reference-manifest.js"),
        manifestFixture("/pos/page", ["static/chunks/pos-page-aaa.js"], []),
      );
      writeFileSync(
        join(groupedDir, "page_client-reference-manifest.js"),
        manifestFixture(
          "/settings/(advanced)/advanced/page",
          ["static/chunks/advanced-page-bbb.js"],
          [],
        ),
      );
      writeFileSync(
        join(tempRoot, "build-manifest.json"),
        JSON.stringify({ polyfillFiles: [], rootMainFiles: ["static/chunks/main-xyz.js"] }),
      );
      mkdirSync(join(tempRoot, "static", "chunks"), { recursive: true });
      writeFileSync(join(tempRoot, "static", "chunks", "pos-page-aaa.js"), "x".repeat(1000));
      writeFileSync(join(tempRoot, "static", "chunks", "advanced-page-bbb.js"), "x".repeat(500));
      writeFileSync(join(tempRoot, "static", "chunks", "main-xyz.js"), "x".repeat(80));

      const sizes = collectRouteSizes(serverApp, {
        rootManifestPath: join(tempRoot, "build-manifest.json"),
        chunkRoot: tempRoot,
      });

      // /pos = own page chunk (1000) + shared root main file (80).
      expect(sizes["/pos"].bytes).toBe(1080);
      expect(sizes["/settings/advanced"].bytes).toBe(580);
      expect(sizes["/pos"].files).toContain("static/chunks/pos-page-aaa.js");
      expect(sizes["/pos"].files).toContain("static/chunks/main-xyz.js");
    });
  });

  describe("diffRouteSizes", () => {
    it("flags a route as regression when it grows beyond the 1% threshold", () => {
      const baseline = { "/pos": { bytes: 1000, files: ["page-a.js"] } };
      const current = { "/pos": { bytes: 1020, files: ["page-b.js"] } };

      const result = diffRouteSizes(baseline, current);

      expect(result.regressions).toEqual([
        { route: "/pos", baselineBytes: 1000, currentBytes: 1020, deltaPct: 2 },
      ]);
    });

    it("treats growth within the threshold and reductions as non-regressions", () => {
      const baseline = {
        "/pos": { bytes: 1000, files: ["page-a.js"] },
        "/expenses": { bytes: 800, files: ["page-b.js"] },
      };
      const current = {
        "/pos": { bytes: 1005, files: ["page-a2.js"] },
        "/expenses": { bytes: 600, files: ["page-b2.js"] },
      };

      const result = diffRouteSizes(baseline, current);

      expect(result.regressions).toEqual([]);
      expect(result.improvements).toEqual([
        { route: "/expenses", baselineBytes: 800, currentBytes: 600, deltaPct: -25 },
      ]);
    });
  });
});
