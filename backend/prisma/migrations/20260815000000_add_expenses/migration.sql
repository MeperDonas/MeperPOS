-- CreateEnum
CREATE TYPE "ExpensePaymentStatus" AS ENUM ('PARTIAL', 'PAID');

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "supplierId" TEXT,
    "purchaseOrderId" TEXT,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "status" "ExpensePaymentStatus" NOT NULL,
    "receiptUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpensePayment" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpensePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_organizationId_name_key" ON "ExpenseCategory"("organizationId", "name");

-- CreateIndex
CREATE INDEX "ExpenseCategory_organizationId_active_idx" ON "ExpenseCategory"("organizationId", "active");

-- CreateIndex
CREATE INDEX "Expense_organizationId_date_idx" ON "Expense"("organizationId", "date");

-- CreateIndex
CREATE INDEX "Expense_organizationId_categoryId_idx" ON "Expense"("organizationId", "categoryId");

-- CreateIndex
CREATE INDEX "ExpensePayment_organizationId_expenseId_idx" ON "ExpensePayment"("organizationId", "expenseId");

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data backfill: five default expense categories (Spanish) for every existing organization
INSERT INTO "ExpenseCategory" ("id", "organizationId", "name", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", n."name", TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Organization" AS o
CROSS JOIN (
    VALUES ('Arriendo'), ('Pago mensual'), ('Seguridad'), ('Salida de empleados'), ('Caja menor')
) AS n("name");
