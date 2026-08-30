import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectRouteSizes, diffRouteSizes } from "./build-size.mjs";

describe("build-size harness", () => {
  let tempRoot;

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), "build-size-"));
  });

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  describe("collectRouteSizes", () => {
    it("sums page chunk bytes per route directory", () => {
      const posDir = join(tempRoot, "chunks", "app", "pos");
      mkdirSync(posDir, { recursive: true });
      writeFileSync(join(posDir, "page-aaa111.js"), "x".repeat(1000));
      writeFileSync(join(posDir, "page-bbb222.js"), "x".repeat(500));

      const sizes = collectRouteSizes(join(tempRoot, "chunks", "app"));

      expect(sizes["/pos"]).toEqual({
        bytes: 1500,
        files: ["page-aaa111.js", "page-bbb222.js"],
      });
    });

    it("maps route groups and dynamic segments to their URL route", () => {
      const groupedDir = join(
        tempRoot,
        "chunks",
        "app",
        "settings",
        "(advanced)",
        "advanced",
      );
      const dynamicDir = join(tempRoot, "chunks", "app", "sales", "[id]");
      mkdirSync(groupedDir, { recursive: true });
      mkdirSync(dynamicDir, { recursive: true });
      writeFileSync(join(groupedDir, "page-abc.js"), "x".repeat(120));
      writeFileSync(join(dynamicDir, "page-def.js"), "x".repeat(340));

      const sizes = collectRouteSizes(join(tempRoot, "chunks", "app"));

      expect(sizes["/settings/advanced"].bytes).toBe(120);
      expect(sizes["/sales/[id]"].bytes).toBe(340);
    });

    it("assigns root-level layout chunks to the / route", () => {
      mkdirSync(join(tempRoot, "chunks", "app"), { recursive: true });
      writeFileSync(join(tempRoot, "chunks", "app", "layout-xyz.js"), "x".repeat(80));

      const sizes = collectRouteSizes(join(tempRoot, "chunks", "app"));

      expect(sizes["/"].bytes).toBe(80);
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
