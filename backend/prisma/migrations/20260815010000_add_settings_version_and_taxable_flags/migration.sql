-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "settingsVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "taxable" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "taxable" BOOLEAN NOT NULL DEFAULT false;
