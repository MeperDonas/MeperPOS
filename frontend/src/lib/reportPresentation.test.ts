import { describe, expect, it } from "vitest";
import { adaptiveReportGranularity, safeDecimalNumber } from "./reportPresentation";

describe("report presentation contract", () => {
  it("converts valid Decimal strings only for display", () => {
    expect(safeDecimalNumber("100000.25")).toBe(100000.25);
    expect(safeDecimalNumber("not-a-decimal")).toBe(0);
  });

  it("uses daily buckets for short ranges and monthly buckets for long ranges", () => {
    expect(adaptiveReportGranularity("2026-01-01", "2026-01-12")).toBe("day");
    expect(adaptiveReportGranularity("2026-01-01", "2026-06-30")).toBe("month");
  });
});
