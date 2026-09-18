import * as fs from 'fs';
import * as path from 'path';

/**
 * Deployment contract (issue #116 / AUDIT-FINDING-010): exactly one versioned
 * owner applies production schema migrations.
 *
 * The owner is versioned in backend/package.json:
 *  - `migrate:prod` (`prisma migrate deploy`) is the single migration entry point;
 *  - `start:prod` (the Railway start command) invokes it strictly before the
 *    application process, so a failed migration kills the deploy instead of
 *    serving code against an older schema;
 *  - no build-phase script (`prebuild` included) touches the database.
 *
 * The commands are split into sequential stages instead of compared as whole
 * strings, so reordering flags, quoting or whitespace does not break the
 * contract while the ordering guarantee stays pinned.
 */

const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');

/** Any Prisma migration command, whatever the subcommand. */
const MIGRATION_COMMAND = /\bprisma\s+migrate\b/;

/** The versioned deploy subcommand. */
const MIGRATE_DEPLOY = /\bprisma\s+migrate\s+deploy\b/;

/** Invocation of the production migration script. */
const MIGRATE_PROD_INVOCATION = /\bmigrate:prod\b/;

/** The production application process: the compiled NestJS entry point. */
const APPLICATION_PROCESS = /\bnode\b[^&|;]*dist[\\/]src[\\/]main\.js/;

interface PackageManifest {
  scripts?: Record<string, string>;
}

/**
 * Splits a chained npm script into its sequential stages. `&&`, `||`, `;` and
 * `|` all evaluate their operands from left to right, so a stage index is a
 * reliable ordering signal.
 */
function stagesOf(command: string): string[] {
  return command
    .split(/\s*(?:&&|\|\||;|\|)\s*/)
    .map((stage) => stage.trim())
    .filter((stage) => stage.length > 0);
}

function stageIndexOf(command: string, matcher: RegExp): number {
  return stagesOf(command).findIndex((stage) => matcher.test(stage));
}

describe('deployment contract: one versioned migration owner (issue #116)', () => {
  let scripts: Record<string, string>;

  beforeAll(() => {
    const manifest = JSON.parse(
      fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'),
    ) as PackageManifest;
    scripts = manifest.scripts ?? {};
  });

  it('start:prod applies migrations strictly before the application process (criterion #1)', () => {
    const startProd = scripts['start:prod'];
    expect(typeof startProd).toBe('string');

    const migrationStage = stageIndexOf(startProd, MIGRATE_PROD_INVOCATION);
    const applicationStage = stageIndexOf(startProd, APPLICATION_PROCESS);

    expect(migrationStage).toBeGreaterThanOrEqual(0);
    expect(applicationStage).toBeGreaterThanOrEqual(0);
    expect(migrationStage).toBeLessThan(applicationStage);
  });

  it('migrate:prod runs prisma migrate deploy', () => {
    expect(scripts['migrate:prod']).toMatch(MIGRATE_DEPLOY);
  });

  it('keeps migrate:prod as the only script that deploys migrations', () => {
    const deployOwners = Object.entries(scripts)
      .filter(([, command]) => MIGRATE_DEPLOY.test(command))
      .map(([name]) => name);

    expect(deployOwners).toEqual(['migrate:prod']);
  });

  it('prebuild does not run any migration command (criterion #3)', () => {
    expect(typeof scripts['prebuild']).toBe('string');
    expect(scripts['prebuild']).not.toMatch(MIGRATION_COMMAND);
  });

  it('no other build-phase script runs a migration command (criterion #3)', () => {
    const buildPhaseScripts = Object.entries(scripts).filter(([name]) =>
      /build|prepare/i.test(name),
    );

    // The build-phase surface must be visible: if these scripts are renamed,
    // this spec has to be revisited instead of silently passing.
    expect(buildPhaseScripts.map(([name]) => name)).toEqual(
      expect.arrayContaining(['build', 'prebuild']),
    );

    const offenders = buildPhaseScripts
      .filter(([, command]) => MIGRATION_COMMAND.test(command))
      .map(([name]) => name);

    expect(offenders).toEqual([]);
  });
});
