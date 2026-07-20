-- Add enum values required by force-close workflow.
-- PostgreSQL enum additions are intentionally append-only.
ALTER TYPE "SaleStatus" ADD VALUE IF NOT EXISTS 'OPEN';
ALTER TYPE "SaleStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
