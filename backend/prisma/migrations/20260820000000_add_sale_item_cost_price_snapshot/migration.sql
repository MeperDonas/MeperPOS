-- Preserve the product cost used by each sale item for exact historical COGS.
ALTER TABLE "SaleItem" ADD COLUMN "costPriceSnapshot" DECIMAL(10,2);
