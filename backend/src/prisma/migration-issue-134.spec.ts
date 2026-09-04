import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../../prisma/migrations/20260903210000_expense_taxonomy_groups_labels_issue_134/migration.sql',
);

describe('issue #134 expense taxonomy migration', () => {
  let sql: string;

  beforeAll(() => {
    sql = readFileSync(migrationPath, 'utf8');
  });

  it('declares the complete six-group default taxonomy and legacy mappings', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "ExpenseGroup"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "ExpenseLabel"');

    for (const group of [
      'Gastos del local',
      'Gastos de empleados',
      'Mercancía',
      'Caja menor',
      'Transporte',
      'Herramientas y equipos',
    ]) {
      expect(sql).toContain(`'${group}'`);
    }

    expect(sql).toContain("'Arriendo'");
    expect(sql).toContain("'Pago mensual'");
    expect(sql).toContain("'Salida de empleados'");
    expect(sql).toContain("WHEN 'Pago mensual' THEN 'Servicios'");
    expect(sql).toContain("WHEN 'Salida de empleados' THEN 'Gastos de empleados'");
    expect(sql).toContain("ELSE 'Gastos del local'");
  });

  it('adds a non-null label relation while preserving every expense and removing legacy structures', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "labelId" TEXT');
    expect(sql).toContain('UPDATE "Expense"');
    expect(sql).toContain('COUNT(*)');
    expect(sql).toContain('"labelId" IS NULL');
    expect(sql).toContain('SET NOT NULL');
    expect(sql).toContain('DROP COLUMN IF EXISTS "categoryId"');
    expect(sql).toContain('DROP TABLE IF EXISTS "ExpenseCategory"');
  });

  it('is transaction-safe and guarded for an idempotent rerun', () => {
    expect(sql).toMatch(/BEGIN;[\s\S]*COMMIT;/);
    expect(sql).toContain('IF NOT EXISTS');
    expect(sql).toContain('IF EXISTS');
    expect(sql).toContain('ON CONFLICT');
  });
});
