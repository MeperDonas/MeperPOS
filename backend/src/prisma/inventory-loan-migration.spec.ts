import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../../prisma/migrations/20261009040000_inventory_loan_foundation/migration.sql',
);
const sql = existsSync(migrationPath)
  ? readFileSync(migrationPath, 'utf8')
  : '';
const schema = readFileSync(
  resolve(__dirname, '../../prisma/schema.prisma'),
  'utf8',
);

// Declaration checks only: no PostgreSQL execution, rollback or race proof.
describe('inventory loan migration declarations', () => {
  it.each(['InventoryLoan', 'InventoryLoanItem', 'InventoryLoanEvent'])(
    'declares additive %s persistence in both artifacts',
    (model) => {
      expect(schema).toContain(`model ${model} {`);
      expect(sql).toContain(`CREATE TABLE "${model}"`);
    },
  );

  it('binds counterparties and employee membership to the loan tenant', () => {
    expect(sql).toContain(
      'num_nonnulls("customerId", "supplierId", "employeeId") = 1',
    );
    for (const [field, target, key] of [
      ['customerId', 'Customer', 'id'],
      ['supplierId', 'Supplier', 'id'],
      ['employeeId', 'OrganizationUser', 'userId'],
    ]) {
      expect(sql).toContain(
        `FOREIGN KEY ("${field}", "organizationId") REFERENCES "${target}"("${key}", "organizationId")`,
      );
    }
    expect(sql).not.toContain('MATCH FULL');
    expect(schema).toContain('references: [userId, organizationId]');
  });

  it('binds items to scoped loans/products and events to the same item AND loan', () => {
    expect(sql).toContain(
      'FOREIGN KEY ("productId", "organizationId") REFERENCES "Product"("id", "organizationId")',
    );
    expect(
      sql.match(
        /FOREIGN KEY \("loanId", "organizationId"\) REFERENCES "InventoryLoan"/g,
      ),
    ).toHaveLength(2);
    expect(sql).toContain(
      'FOREIGN KEY ("itemId", "loanId", "organizationId") REFERENCES "InventoryLoanItem"("id", "loanId", "organizationId")',
    );
    const item = schema.split('model InventoryLoanItem {')[1].split('\n}')[0];
    const event = schema.split('model InventoryLoanEvent {')[1].split('\n}')[0];
    expect(item).toContain('@@unique([id, loanId, organizationId])');
    expect(event).toContain('references: [id, loanId, organizationId]');
    expect(event).toContain('fields: [itemId, loanId, organizationId]');
  });

  it('declares integer bounds and nullable header versus positive item event shapes', () => {
    for (const check of [
      '"quantity" > 0',
      '"deliveredQuantity" >= 0',
      '"returnedQuantity" >= 0',
      '"cancelledQuantity" >= 0',
      '"returnedQuantity" <= "deliveredQuantity"',
      '"deliveredQuantity" <= "quantity" - "cancelledQuantity"',
      '"version" >= 0',
      '"itemId" IS NULL AND "quantity" IS NULL',
      '"itemId" IS NOT NULL AND "quantity" IS NOT NULL AND "quantity" > 0',
      "\"type\" IN ('CREATED', 'CANCELLED')",
      "\"type\" IN ('DELIVERED', 'RETURNED', 'CANCELLED')",
    ])
      expect(sql).toContain(check);
    expect(sql).toContain("'CREATED', 'DELIVERED', 'RETURNED', 'CANCELLED'");
    expect(sql).toContain(
      "CREATE TYPE \"InventoryLoanStatus\" AS ENUM ('OPEN', 'CANCELLED')",
    );
    expect(sql).not.toContain('requestKey');
    expect(sql).not.toContain('reservedRemaining');
  });

  it('protects append-only events and immutable loan/item identity without money DDL', () => {
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON "InventoryLoanEvent"');
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON "InventoryLoan"');
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON "InventoryLoanItem"');
    for (const field of [
      'id',
      'organizationId',
      'customerId',
      'supplierId',
      'employeeId',
      'createdById',
      'createdAt',
      'productId',
      'loanId',
      'quantity',
    ])
      expect(sql).toContain(`OLD."${field}"`);
    expect(sql).toContain("TG_OP = 'DELETE'");
    for (const field of [
      'deliveredQuantity',
      'returnedQuantity',
      'cancelledQuantity',
    ])
      expect(sql).toContain(`NEW."${field}" < OLD."${field}"`);
    expect(sql).not.toMatch(
      /(?:ALTER|CREATE) TABLE "(?:MoneyLoan|Sale|Payment)"/,
    );
  });
});
