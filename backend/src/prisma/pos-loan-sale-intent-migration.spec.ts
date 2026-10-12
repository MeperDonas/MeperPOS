import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../../prisma/migrations/20261009080000_pos_loan_sale_intent/migration.sql',
);
// Absent planned SQL is assertion input, not a fixture or a read-time exception.
const sql = existsSync(migrationPath)
  ? readFileSync(migrationPath, 'utf8')
  : '';
const schema = readFileSync(
  resolve(__dirname, '../../prisma/schema.prisma'),
  'utf8',
);
const legacySql = readFileSync(
  resolve(
    __dirname,
    '../../prisma/migrations/20261009000000_add_money_loans/migration.sql',
  ),
  'utf8',
);
const modelBody = (name: string) =>
  schema.split(`model ${name} {`)[1]?.split('\n}')[0] ?? '';
const compact = (source: string) => source.replace(/\s+/g, '');
const intent = modelBody('PosLoanSaleIntent');
const ddl = compact(sql);
const table =
  sql.match(/CREATE\s+TABLE\s+"PosLoanSaleIntent"\s*\(([\s\S]*?)\);/i)?.[1] ??
  '';
const columns = (names: readonly string[]) =>
  names.map((name) => `"${name}"`).join(',');
const scope = ['id', 'organizationId', 'customerId'];

// Source declarations only: no PostgreSQL execution, trigger behavior or CAS/race proof.
describe('POS loan sale intent declarations (not executed SQL)', () => {
  it('retains independent loans and nullable legacy sale customers', () => {
    expect(modelBody('MoneyLoan')).toMatch(/customerId\s+String\?/);
    expect(modelBody('MoneyLoan')).toMatch(/supplierId\s+String\?/);
    expect(modelBody('MoneyLoan')).toMatch(/employeeId\s+String\?/);
    expect(modelBody('MoneyLoan')).toMatch(/version\s+Int\s+@default\(0\)/);
    expect(modelBody('MoneyLoan')).not.toMatch(/^\s*origin\s/m);
    expect(modelBody('Sale')).toMatch(/customerId\s+String\?/);
    expect(compact(modelBody('Customer'))).toContain(
      '@@unique([id,organizationId])',
    );
    expect(compact(legacySql)).toContain(
      'num_nonnulls("customerId","supplierId","employeeId")=1',
    );
  });

  it('declares a minimal child with server creation metadata and single claims', () => {
    expect(schema).toContain('model PosLoanSaleIntent {');
    expect(existsSync(migrationPath)).toBe(true);
    expect(sql).toMatch(/CREATE\s+TABLE\s+"PosLoanSaleIntent"/i);
    expect(intent).toMatch(/\bid\s+String\s+@id\s+@default\(uuid\(\)\)/);
    for (const field of ['organizationId', 'loanId', 'customerId']) {
      expect(intent).toMatch(new RegExp(`\\b${field}\\s+String(?!\\?)\\b`));
      expect(table).toMatch(new RegExp(`"${field}"\\s+TEXT\\s+NOT NULL`, 'i'));
    }
    expect(table).toMatch(/PRIMARY\s+KEY\s*\(\s*"id"\s*\)/i);
    expect(intent).toMatch(/createdAt\s+DateTime\s+@default\(now\(\)\)/);
    expect(table).toMatch(
      /"createdAt"\s+TIMESTAMP(?:\(\d+\))?\s+NOT NULL\s+DEFAULT\s+CURRENT_TIMESTAMP/i,
    );
    expect(intent).toMatch(/finalSaleId\s+String\?\s+@unique/);
    expect(table).toMatch(/"finalSaleId"\s+TEXT\s*[,\n]/i);
    expect(intent).toMatch(/loanId\s+String\s+@unique/);
    for (const field of ['loanId', 'finalSaleId']) {
      expect(ddl).toMatch(
        new RegExp(
          `CREATEUNIQUEINDEX[^;]+ON"PosLoanSaleIntent"\\("${field}"\\)`,
        ),
      );
    }
    expect(intent).not.toMatch(
      /\b(?:origin|amount|price|total|status|items|payments|createdById|actorId)\s/,
    );
  });

  it('declares scoped restrictive relations and optional one-to-one backlinks', () => {
    for (const [target, fields, references, optional] of [
      ['Organization', ['organizationId'], ['id'], false],
      [
        'Customer',
        ['customerId', 'organizationId'],
        ['id', 'organizationId'],
        false,
      ],
      ['MoneyLoan', ['loanId', 'organizationId', 'customerId'], scope, false],
      ['Sale', ['finalSaleId', 'organizationId', 'customerId'], scope, true],
    ] as const) {
      const relation =
        intent
          .split('\n')
          .find((line) =>
            new RegExp(
              `\\s${target}${optional ? '\\?' : ''}\\s+@relation\\(`,
            ).test(line),
          ) ?? '';
      expect(compact(relation)).toContain(
        `fields:[${fields.join(',')}],references:[${references.join(',')}]`,
      );
      expect(compact(relation)).toContain('onDelete:Restrict');
      expect(compact(relation)).toContain('onUpdate:Restrict');
      expect(ddl).toContain(
        `FOREIGNKEY(${columns(fields)})REFERENCES"${target}"(${columns(references)})ONDELETERESTRICTONUPDATERESTRICT`,
      );
    }
    for (const parent of ['MoneyLoan', 'Sale']) {
      expect(compact(modelBody(parent))).toContain(
        `@@unique([${scope.join(',')}])`,
      );
      expect(ddl).toMatch(
        new RegExp(
          `CREATEUNIQUEINDEX[^;]+ON"${parent}"\\(${columns(scope)}\\)`,
        ),
      );
      expect(modelBody(parent)).toMatch(/\sPosLoanSaleIntent\?\s/);
    }
    for (const parent of ['Customer', 'Organization']) {
      expect(modelBody(parent)).toMatch(/\sPosLoanSaleIntent\[\]\s/);
    }
    expect(sql).not.toMatch(/MATCH\s+FULL/i);
  });

  it('declares delete protection, immutable identity and a non-replaceable final claim', () => {
    const trigger = sql.match(
      /BEFORE\s+UPDATE\s+OR\s+DELETE\s+ON\s+"PosLoanSaleIntent"\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+"([^"]+)"\(\)/i,
    );
    expect(trigger).not.toBeNull();
    // Resolve the real trigger function instead of prescribing its identifier.
    const functions = [
      ...sql.matchAll(
        /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"([^"]+)"\(\)\s+RETURNS\s+trigger\s+AS\s+\$\$([\s\S]*?)\$\$\s+LANGUAGE\s+plpgsql/gi,
      ),
    ];
    const guard =
      functions.find((match) => match[1] === trigger?.[1])?.[2] ?? '';
    expect(guard).toMatch(
      /IF\s+TG_OP\s*=\s*'DELETE'\s+THEN\s+RAISE\s+EXCEPTION/i,
    );
    for (const field of [
      'id',
      'organizationId',
      'loanId',
      'customerId',
      'createdAt',
    ]) {
      expect(guard).toMatch(
        new RegExp(
          `NEW\\."${field}"\\s+IS DISTINCT FROM\\s+OLD\\."${field}"`,
          'i',
        ),
      );
    }
    expect(guard).toMatch(
      /OLD\."finalSaleId"\s+IS NOT NULL\s+AND\s+NEW\."finalSaleId"\s+IS DISTINCT FROM\s+OLD\."finalSaleId"/i,
    );
    expect(guard).toMatch(/THEN\s+RAISE\s+EXCEPTION/i);
    expect(guard).toMatch(/RETURN\s+NEW\s*;/i);
    expect(guard).not.toMatch(/NEW\."finalSaleId"\s+IS NOT NULL/i);
  });

  it('adds only intent persistence and parent keys, without financial or kind policy changes', () => {
    expect(sql).not.toMatch(
      /\b(?:DROP|TRUNCATE)\b|\bUPDATE\s+"|\bDELETE\s+FROM\b|\bINSERT\s+INTO\b/i,
    );
    expect(sql).not.toMatch(/\b(?:CREATE|ALTER)\s+TYPE\b|\bADD\s+COLUMN\b/i);
    expect(
      [...sql.matchAll(/CREATE\s+TABLE\s+"([^"]+)"/gi)].map(
        (match) => match[1],
      ),
    ).toEqual(['PosLoanSaleIntent']);
    expect(sql).not.toMatch(
      /"(?:Payment|MoneyLoanEvent|AuditLog|SaleItem)"|'(?:MONEY|SERVICE)'/,
    );
    expect(table).not.toMatch(
      /"(?:amount|price|total|status|items|payments|createdById|actorId)"/,
    );
    expect(schema).not.toContain('model MoneyLoanSale {');
    expect(modelBody('Sale')).not.toMatch(/^\s*(?:supplierId|employeeId)\s/m);
  });
});
