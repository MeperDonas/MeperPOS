BEGIN;

CREATE TABLE IF NOT EXISTS "ExpenseGroup" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExpenseGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ExpenseLabel" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExpenseLabel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseGroup_organizationId_name_key"
  ON "ExpenseGroup"("organizationId", "name");
CREATE INDEX IF NOT EXISTS "ExpenseGroup_organizationId_active_idx"
  ON "ExpenseGroup"("organizationId", "active");
CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseLabel_groupId_name_key"
  ON "ExpenseLabel"("groupId", "name");
CREATE INDEX IF NOT EXISTS "ExpenseLabel_organizationId_active_idx"
  ON "ExpenseLabel"("organizationId", "active");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExpenseGroup_organizationId_fkey') THEN
    ALTER TABLE "ExpenseGroup" ADD CONSTRAINT "ExpenseGroup_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExpenseLabel_organizationId_fkey') THEN
    ALTER TABLE "ExpenseLabel" ADD CONSTRAINT "ExpenseLabel_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExpenseLabel_groupId_fkey') THEN
    ALTER TABLE "ExpenseLabel" ADD CONSTRAINT "ExpenseLabel_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "ExpenseGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "ExpenseGroup" ("id", "organizationId", "name", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", v."name", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Organization" o
CROSS JOIN (VALUES
  ('Gastos del local'), ('Gastos de empleados'), ('Mercancía'),
  ('Caja menor'), ('Transporte'), ('Herramientas y equipos')
) v("name")
ON CONFLICT ("organizationId", "name") DO UPDATE SET "active" = true;

INSERT INTO "ExpenseLabel" ("id", "organizationId", "groupId", "name", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid(), g."organizationId", g."id", labels."name", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ExpenseGroup" g
JOIN (VALUES
  ('Gastos del local', 'Arriendo'), ('Gastos del local', 'Servicios'), ('Gastos del local', 'Mantenimiento'), ('Gastos del local', 'Insumos'), ('Gastos del local', 'Otros'),
  ('Gastos de empleados', 'Sueldos'), ('Gastos de empleados', 'Prestaciones'), ('Gastos de empleados', 'Adelantos'), ('Gastos de empleados', 'Préstamos mercancia'), ('Gastos de empleados', 'Otros'),
  ('Mercancía', 'Compra a proveedor'), ('Mercancía', 'Compra local externo'), ('Mercancía', 'Fletes'), ('Mercancía', 'Insumos de venta'), ('Mercancía', 'Otros'),
  ('Caja menor', 'Casa'), ('Caja menor', 'Alimentación'), ('Caja menor', 'Transporte'), ('Caja menor', 'Compras menores'), ('Caja menor', 'Diligencias'), ('Caja menor', 'Otros'),
  ('Transporte', 'Combustible'), ('Transporte', 'Mantenimiento'), ('Transporte', 'Envíos'), ('Transporte', 'Parqueadero'), ('Transporte', 'Lavadero'),
  ('Herramientas y equipos', 'Compra'), ('Herramientas y equipos', 'Reparación'), ('Herramientas y equipos', 'Mantenimiento'), ('Herramientas y equipos', 'Repuestos'), ('Herramientas y equipos', 'Otros')
) labels("groupName", "name") ON labels."groupName" = g."name"
ON CONFLICT ("groupId", "name") DO UPDATE SET "active" = true;

ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "labelId" TEXT;

DO $$
DECLARE
  legacy_exists BOOLEAN;
  before_count BIGINT;
  after_count BIGINT;
  null_count BIGINT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'Expense' AND column_name = 'categoryId'
  ) INTO legacy_exists;

  IF legacy_exists THEN
    SELECT COUNT(*) INTO before_count FROM "Expense";
    UPDATE "Expense" e
    SET "labelId" = (
      SELECT l."id"
      FROM "ExpenseCategory" c
      JOIN "ExpenseGroup" g ON g."organizationId" = e."organizationId"
        AND g."name" = CASE c."name"
          WHEN 'Caja menor' THEN 'Caja menor'
          WHEN 'Salida de empleados' THEN 'Gastos de empleados'
          ELSE 'Gastos del local'
        END
      JOIN "ExpenseLabel" l ON l."groupId" = g."id"
        AND l."name" = CASE c."name"
          WHEN 'Arriendo' THEN 'Arriendo'
          WHEN 'Pago mensual' THEN 'Servicios'
          ELSE 'Otros'
        END
      WHERE c."id" = e."categoryId"
    );
    SELECT COUNT(*) INTO after_count FROM "Expense";
    SELECT COUNT(*) INTO null_count FROM "Expense" WHERE "labelId" IS NULL;
    IF before_count <> after_count THEN RAISE EXCEPTION 'Expense count changed during backfill'; END IF;
    IF null_count <> 0 THEN RAISE EXCEPTION 'Expense backfill left NULL labelId values'; END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Expense_labelId_fkey') THEN
    ALTER TABLE "Expense" ADD CONSTRAINT "Expense_labelId_fkey"
      FOREIGN KEY ("labelId") REFERENCES "ExpenseLabel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Expense" ALTER COLUMN "labelId" SET NOT NULL;
ALTER TABLE "Expense" DROP CONSTRAINT IF EXISTS "Expense_categoryId_fkey";
ALTER TABLE "Expense" DROP COLUMN IF EXISTS "categoryId";
DROP TABLE IF EXISTS "ExpenseCategory";

COMMIT;
