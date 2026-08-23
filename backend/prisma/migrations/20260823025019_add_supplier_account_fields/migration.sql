-- CreateEnum
CREATE TYPE "SupplierAccountType" AS ENUM ('SAVINGS', 'CHECKING');

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "accountNumber" TEXT,
ADD COLUMN     "accountType" "SupplierAccountType";
