-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('PERCENTAGE', 'FIXED_PRICE');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "promotionType" "PromotionType",
ADD COLUMN     "promotionValue" DECIMAL(10,2);
