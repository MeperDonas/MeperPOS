-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "tracksStock" BOOLEAN NOT NULL DEFAULT true;

-- The six existing services are already untracked by the rule, but the stored data has to say
-- so: every one of them has stock 0 and minStock 5, so a row left at the default would be a
-- low-stock alert waiting to fire.
UPDATE "Product" SET "tracksStock" = false WHERE "type" = 'SERVICE';

-- CreateIndex
CREATE INDEX "Product_organizationId_tracksStock_idx" ON "Product"("organizationId", "tracksStock");
