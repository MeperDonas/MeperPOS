import { describe, expect, it, vi } from "vitest";
import { getPOSCapacity, observePOSGrid } from "./pos-layout";

describe("POS grid measurement lifecycle", () => {
  it("updates only when capacity changes and disconnects the observer", () => {
    let resize = () => {};
    const disconnect = vi.fn();
    const observe = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { resize = callback; }
      observe = observe;
      disconnect = disconnect;
    });
    const area = document.createElement("div");
    const grid = document.createElement("div");
    let height = 552;
    Object.defineProperty(area, "clientHeight", { get: () => height });
    Object.defineProperty(grid, "clientWidth", { value: 600 });
    const style = vi.spyOn(window, "getComputedStyle").mockImplementation((element) => (element === area
      ? { paddingTop: "16px", paddingBottom: "16px" }
      : { gridTemplateColumns: "192px 192px 192px", gridAutoRows: "248px", columnGap: "12px", rowGap: "12px" }) as unknown as CSSStyleDeclaration);
    const update = vi.fn();
    const stop = observePOSGrid(area, grid, update);
    expect(update).toHaveBeenLastCalledWith(6);
    resize();
    expect(update).toHaveBeenCalledTimes(1);
    height = 300;
    resize();
    expect(update).toHaveBeenLastCalledWith(3);
    expect(observe).toHaveBeenCalledWith(area);
    stop();
    expect(disconnect).toHaveBeenCalledOnce();
    style.mockRestore();
    vi.unstubAllGlobals();
  });

  it("uses a removable window resize fallback without ResizeObserver", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const update = vi.fn();
    const stop = observePOSGrid(document.createElement("div"), document.createElement("div"), update);
    expect(update).toHaveBeenCalledWith(1);
    stop();
    window.dispatchEvent(new Event("resize"));
    expect(update).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});

describe("POS capacity from measured grid geometry", () => {
  it("fits only complete cards and gaps, not a fixed twenty", () => {
    expect(getPOSCapacity({ width: 600, height: 520, cardWidth: 192, cardHeight: 248, columnGap: 12, rowGap: 12 })).toBe(6);
    expect(getPOSCapacity({ width: 600, height: 507, cardWidth: 192, cardHeight: 248, columnGap: 12, rowGap: 12 })).toBe(3);
  });
  it("keeps one readable card on narrow/short panels and during zero-size fallback", () => {
    expect(getPOSCapacity({ width: 160, height: 248, cardWidth: 160, cardHeight: 248, columnGap: 12, rowGap: 12 })).toBe(1);
    expect(getPOSCapacity({ width: 0, height: 0, cardWidth: 0, cardHeight: 0, columnGap: 12, rowGap: 12 })).toBe(1);
  });
  it("uses actual card dimensions when width changes and stays stable for subpixel noise", () => {
    const geometry = { width: 380, height: 510, cardWidth: 184, cardHeight: 248, columnGap: 12, rowGap: 12 };
    expect(getPOSCapacity(geometry)).toBe(4);
    expect(getPOSCapacity({ ...geometry, width: 380.1 })).toBe(4);
    expect(getPOSCapacity({ ...geometry, cardHeight: 300 })).toBe(2);
  });
});
