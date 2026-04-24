-- CreateTable
CREATE TABLE "CashRegister" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashRegister_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashRegister_organizationId_idx" ON "CashRegister"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CashRegister_organizationId_name_key" ON "CashRegister"("organizationId", "name");

-- AddForeignKey
ALTER TABLE "CashRegister" ADD CONSTRAINT "CashRegister_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
