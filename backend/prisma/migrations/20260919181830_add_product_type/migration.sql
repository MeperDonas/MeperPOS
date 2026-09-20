-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PRODUCT', 'SERVICE');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "type" "ProductType" NOT NULL DEFAULT 'PRODUCT';

-- CreateIndex
CREATE INDEX "Product_organizationId_type_idx" ON "Product"("organizationId", "type");
