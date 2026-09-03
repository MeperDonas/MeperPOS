import { describe, expect, it } from "vitest";
import { passingSuites } from "./check-quarantine.mjs";

// Locked against a REAL Vitest v4 JSON reporter capture (see design.md open
// question): testResults[] entries carry { name: <file path>, status }.

const passingEntry = {
  name: "C:/repo/frontend/src/components/dashboard/CategoryStackedChart.test.tsx",
  status: "passed",
};

const failingEntry = {
  name: "C:/repo/frontend/src/app/admin/organizations/[id]/page.test.tsx",
  status: "failed",
};

describe("check-quarantine passingSuites parser", () => {
  it("names the quarantined suites that are passing", () => {
    const report = {
      success: true,
      testResults: [
        { ...passingEntry, name: "C:/repo/frontend/src/app/sales/page.behavior.test.tsx" },
        failingEntry,
        passingEntry,
      ],
    };

    expect(passingSuites(report)).toEqual([
      "C:/repo/frontend/src/app/sales/page.behavior.test.tsx",
      "C:/repo/frontend/src/components/dashboard/CategoryStackedChart.test.tsx",
    ]);
  });

  it("omits failed suites entirely", () => {
    const report = { testResults: [failingEntry] };

    expect(passingSuites(report)).toEqual([]);
  });

  it("returns an empty array for an empty or missing report", () => {
    expect(passingSuites({ testResults: [] })).toEqual([]);
    expect(passingSuites(undefined)).toEqual([]);
    expect(passingSuites(null)).toEqual([]);
  });
});
