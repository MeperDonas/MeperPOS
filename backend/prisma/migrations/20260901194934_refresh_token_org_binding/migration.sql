-- Additive org binding for refresh tokens (issue #48, design D3.1).
-- Nullable column + index only: legacy rows keep organizationId NULL and fall
-- back to first-joined membership on refresh, so the migration is safe to
-- deploy and safe to roll back.

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "organizationId" TEXT;

-- CreateIndex
CREATE INDEX "RefreshToken_organizationId_idx" ON "RefreshToken"("organizationId");
