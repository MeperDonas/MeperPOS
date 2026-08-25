import { describe, expect, it } from "vitest";
import { resolveTaxFields } from "./utils";

describe("resolveTaxFields", () => {
  it("keeps a product taxable with a positive entered rate", () => {
    expect(resolveTaxFields("19")).toEqual({ taxable: true, taxRate: 19 });
    expect(resolveTaxFields("19.5")).toEqual({ taxable: true, taxRate: 19.5 });
  });

  it("marks the product NOT taxable when 0 is entered", () => {
    expect(resolveTaxFields("0")).toEqual({ taxable: false, taxRate: 0 });
    expect(resolveTaxFields("0.0")).toEqual({ taxable: false, taxRate: 0 });
  });

  it("marks the product NOT taxable when the field is empty", () => {
    expect(resolveTaxFields("")).toEqual({ taxable: false, taxRate: 0 });
    expect(resolveTaxFields("   ")).toEqual({ taxable: false, taxRate: 0 });
  });

  it("does not send taxable:true with a 0 rate for a non-numeric value", () => {
    // NaN falls through to non-taxable rather than a rejected taxable:true+0.
    expect(resolveTaxFields("abc")).toEqual({ taxable: false, taxRate: 0 });
  });
});
