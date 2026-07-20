-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- DropForeignKey
ALTER TABLE "Settings" DROP CONSTRAINT "Settings_userId_fkey";

-- DropIndex
DROP INDEX "Category_name_key";

-- DropIndex
DROP INDEX "Customer_documentNumber_key";

-- DropIndex
DROP INDEX "InventoryMovement_productId_createdAt_idx";

-- DropIndex
DROP INDEX "Payment_saleId_idx";

-- DropIndex
DROP INDEX "Product_barcode_key";

-- DropIndex
DROP INDEX "Product_sku_key";

-- DropIndex
DROP INDEX "PurchaseOrder_createdAt_idx";

-- DropIndex
DROP INDEX "PurchaseOrder_orderNumber_key";

-- DropIndex
DROP INDEX "PurchaseOrder_status_idx";

-- DropIndex
DROP INDEX "PurchaseOrder_supplierId_idx";

-- DropIndex
DROP INDEX "PurchaseOrderItem_productId_idx";

-- DropIndex
DROP INDEX "PurchaseOrderItem_purchaseOrderId_idx";

-- DropIndex
DROP INDEX "Sale_createdAt_status_idx";

-- DropIndex
DROP INDEX "Sale_saleNumber_key";

-- DropIndex
DROP INDEX "SaleItem_productId_idx";

-- DropIndex
DROP INDEX "SaleItem_saleId_idx";

-- DropIndex
DROP INDEX "Supplier_active_idx";

-- DropIndex
DROP INDEX "Supplier_documentNumber_key";

-- DropIndex
DROP INDEX "Supplier_name_idx";

-- DropIndex
DROP INDEX "Task_assignedToId_status_idx";

-- DropIndex
DROP INDEX "Task_createdById_updatedAt_idx";

-- DropIndex
DROP INDEX "Task_deletedAt_idx";

-- DropIndex
DROP INDEX "Task_status_createdAt_idx";

-- DropIndex
DROP INDEX "TaskEvent_createdById_createdAt_idx";

-- DropIndex
DROP INDEX "TaskEvent_taskId_createdAt_idx";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "organizationId" TEXT NOT NULL,
ALTER COLUMN "orderNumber" DROP DEFAULT;
DROP SEQUENCE "PurchaseOrder_orderNumber_seq";

-- AlterTable
ALTER TABLE "PurchaseOrderItem" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" TEXT,
ADD COLUMN     "organizationId" TEXT NOT NULL,
ALTER COLUMN "saleNumber" DROP DEFAULT;
DROP SEQUENCE "Sale_saleNumber_seq";

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "TaskEvent" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "Settings";

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nit" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "plan" TEXT NOT NULL DEFAULT 'free',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationSequence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "prefix" TEXT,
    "currentNumber" INTEGER NOT NULL DEFAULT 0,
    "year" INTEGER,

    CONSTRAINT "OrganizationSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "OrganizationUser_organizationId_idx" ON "OrganizationUser"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationUser_userId_organizationId_key" ON "OrganizationUser"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "OrganizationSequence_organizationId_idx" ON "OrganizationSequence"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationSequence_organizationId_type_year_key" ON "OrganizationSequence"("organizationId", "type", "year");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_action_idx" ON "AuditLog"("organizationId", "action");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_resource_idx" ON "AuditLog"("organizationId", "resource");

-- CreateIndex
CREATE INDEX "Category_organizationId_active_idx" ON "Category"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Category_organizationId_name_key" ON "Category"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Customer_organizationId_active_idx" ON "Customer"("organizationId", "active");

-- CreateIndex
CREATE INDEX "Customer_organizationId_segment_idx" ON "Customer"("organizationId", "segment");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_organizationId_documentNumber_key" ON "Customer"("organizationId", "documentNumber");

-- CreateIndex
CREATE INDEX "InventoryMovement_organizationId_productId_createdAt_idx" ON "InventoryMovement"("organizationId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_organizationId_saleId_idx" ON "Payment"("organizationId", "saleId");

-- CreateIndex
CREATE INDEX "Product_organizationId_active_idx" ON "Product"("organizationId", "active");

-- CreateIndex
CREATE INDEX "Product_organizationId_categoryId_idx" ON "Product"("organizationId", "categoryId");

-- Índice parcial para barcode nullable (reemplaza el índice regular generado por Prisma)
CREATE INDEX "Product_organizationId_barcode_idx" ON "Product"("organizationId", "barcode") WHERE "barcode" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Product_organizationId_sku_key" ON "Product"("organizationId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "Product_organizationId_barcode_key" ON "Product"("organizationId", "barcode");

-- CreateIndex
CREATE INDEX "PurchaseOrder_organizationId_status_idx" ON "PurchaseOrder"("organizationId", "status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_organizationId_supplierId_idx" ON "PurchaseOrder"("organizationId", "supplierId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_organizationId_createdAt_idx" ON "PurchaseOrder"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_organizationId_orderNumber_key" ON "PurchaseOrder"("organizationId", "orderNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_organizationId_purchaseOrderId_idx" ON "PurchaseOrderItem"("organizationId", "purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_organizationId_productId_idx" ON "PurchaseOrderItem"("organizationId", "productId");

-- CreateIndex
CREATE INDEX "Sale_organizationId_createdAt_status_idx" ON "Sale"("organizationId", "createdAt", "status");

-- CreateIndex
CREATE INDEX "Sale_organizationId_userId_idx" ON "Sale"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "Sale_organizationId_customerId_idx" ON "Sale"("organizationId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_organizationId_saleNumber_key" ON "Sale"("organizationId", "saleNumber");

-- CreateIndex
CREATE INDEX "SaleItem_organizationId_saleId_idx" ON "SaleItem"("organizationId", "saleId");

-- CreateIndex
CREATE INDEX "SaleItem_organizationId_productId_idx" ON "SaleItem"("organizationId", "productId");

-- CreateIndex
CREATE INDEX "Supplier_organizationId_active_idx" ON "Supplier"("organizationId", "active");

-- CreateIndex
CREATE INDEX "Supplier_organizationId_name_idx" ON "Supplier"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_organizationId_documentNumber_key" ON "Supplier"("organizationId", "documentNumber");

-- CreateIndex
CREATE INDEX "Task_organizationId_status_createdAt_idx" ON "Task"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Task_organizationId_assignedToId_status_idx" ON "Task"("organizationId", "assignedToId", "status");

-- CreateIndex
CREATE INDEX "Task_organizationId_createdById_updatedAt_idx" ON "Task"("organizationId", "createdById", "updatedAt");

-- CreateIndex
CREATE INDEX "Task_organizationId_deletedAt_idx" ON "Task"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX "TaskEvent_organizationId_taskId_createdAt_idx" ON "TaskEvent"("organizationId", "taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskEvent_organizationId_createdById_createdAt_idx" ON "TaskEvent"("organizationId", "createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "OrganizationUser" ADD CONSTRAINT "OrganizationUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationUser" ADD CONSTRAINT "OrganizationUser_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSequence" ADD CONSTRAINT "OrganizationSequence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEvent" ADD CONSTRAINT "TaskEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
