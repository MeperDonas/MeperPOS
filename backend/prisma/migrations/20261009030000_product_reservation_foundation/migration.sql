-- Foundation only: reservation writers remain disabled until all L3B safeguards land.
-- Validate existing stock as-is; never repair negative/inconsistent data here.
ALTER TABLE "Product"
  ADD COLUMN "reservedStock" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "Product_reservedStock_bounds_check"
    CHECK ("reservedStock" >= 0 AND "reservedStock" <= "stock"),
  ADD CONSTRAINT "Product_reservedStock_eligibility_check"
    CHECK ("reservedStock" = 0 OR
      ("active" = true AND "type" = 'PRODUCT' AND "tracksStock" = true));
