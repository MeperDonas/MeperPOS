// Observe the available area, not the content height: fetching fewer cards must
// never change capacity. The pager is a separate, permanently reserved sibling.
export function observePOSGrid(area: HTMLElement, grid: HTMLElement, update: (capacity: number) => void) {
  let lastCapacity = 0;
  let stopped = false;
  const measure = () => {
    if (stopped) return;
    const areaStyle = window.getComputedStyle(area);
    const gridStyle = window.getComputedStyle(grid);
    const capacity = getPOSCapacity({
      width: grid.getBoundingClientRect().width || grid.clientWidth,
      height: area.clientHeight - (parseFloat(areaStyle.paddingTop) || 0) - (parseFloat(areaStyle.paddingBottom) || 0),
      cardWidth: parseFloat(gridStyle.gridTemplateColumns) || 176,
      cardHeight: parseFloat(gridStyle.gridAutoRows) || 248,
      columnGap: parseFloat(gridStyle.columnGap) || 0,
      rowGap: parseFloat(gridStyle.rowGap) || 0,
    });
    if (capacity !== lastCapacity) {
      lastCapacity = capacity;
      update(capacity);
    }
  };
  const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
  observer?.observe(area);
  window.addEventListener("resize", measure);
  measure();
  return () => {
    stopped = true;
    observer?.disconnect();
    window.removeEventListener("resize", measure);
  };
}

type GridGeometry = {
  width: number;
  height: number;
  cardWidth: number;
  cardHeight: number;
  columnGap: number;
  rowGap: number;
};

// Round down to complete tracks. CSS grid track rounding can differ by a tiny
// fraction of a pixel, so tolerate only subpixel noise, not partial cards.
export function getPOSCapacity(geometry: GridGeometry): number {
  const { width, height, cardWidth, cardHeight, columnGap, rowGap } = geometry;
  if (![width, height, cardWidth, cardHeight, columnGap, rowGap].every(Number.isFinite) ||
      width <= 0 || height <= 0 || cardWidth <= 0 || cardHeight <= 0) return 1;
  const columns = Math.max(1, Math.floor((width + columnGap + 0.1) / (cardWidth + columnGap)));
  const rows = Math.max(1, Math.floor((height + rowGap + 0.1) / (cardHeight + rowGap)));
  return columns * rows;
}
