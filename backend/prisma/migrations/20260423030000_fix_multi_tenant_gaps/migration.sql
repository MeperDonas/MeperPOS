-- Create new enums
CREATE TYPE "OrgStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED');
CREATE TYPE "PlanType" AS ENUM ('BASIC', 'PRO');
CREATE TYPE "BillingStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE');

-- Extend OrgRole enum with new values
ALTER TYPE "OrgRole" ADD VALUE 'CASHIER';
ALTER TYPE "OrgRole" ADD VALUE 'INVENTORY_USER';

-- Add isSuperAdmin to User
ALTER TABLE "User" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Add fields to OrganizationUser
ALTER TABLE "OrganizationUser" ADD COLUMN "invitedById" TEXT;
ALTER TABLE "OrganizationUser" ADD COLUMN "isPrimaryOwner" BOOLEAN NOT NULL DEFAULT false;

-- Rename nit to taxId on Organization
ALTER TABLE "Organization" RENAME COLUMN "nit" TO "taxId";

-- Add new columns to Organization
ALTER TABLE "Organization" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "Organization" ADD COLUMN "status" "OrgStatus" NOT NULL DEFAULT 'TRIAL';
ALTER TABLE "Organization" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN "billingStatus" "BillingStatus" NOT NULL DEFAULT 'PENDING';

-- Migrate plan column from String to PlanType enum
-- Step 1: add new enum column
ALTER TABLE "Organization" ADD COLUMN "plan_new" "PlanType";

-- Step 2: map existing values
UPDATE "Organization" SET "plan_new" = CASE
    WHEN "plan" = 'free' THEN 'BASIC'::"PlanType"
    WHEN "plan" = 'pro' THEN 'PRO'::"PlanType"
    ELSE 'BASIC'::"PlanType"
END;

-- Step 3: drop old string column
ALTER TABLE "Organization" DROP COLUMN "plan";

-- Step 4: rename new column
ALTER TABLE "Organization" RENAME COLUMN "plan_new" TO "plan";

-- Step 5: set not null default
ALTER TABLE "Organization" ALTER COLUMN "plan" SET NOT NULL;
ALTER TABLE "Organization" ALTER COLUMN "plan" SET DEFAULT 'BASIC';
