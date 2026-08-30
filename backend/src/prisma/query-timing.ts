// Dev-only Prisma query timing helpers.
//
// Wired by PrismaService only when NODE_ENV !== 'production' and
// PRISMA_QUERY_LOG !== '0' — zero production paths. Used to produce
// before/after query timing evidence (PRISMA_QUERY_DUMP=<label>) for
// performance work tracked in issue #98.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface QueryTimingStat {
  count: number;
  totalMs: number;
  maxMs: number;
}

export type QueryTimingStats = Map<string, QueryTimingStat>;

export interface QueryTimingEvent {
  query: string;
  duration: number;
}

// Maps a raw SQL statement to a "<model>.<verb>" key, e.g. "product.select".
// Falls back to "other.raw" for statements without a recognizable table.
export function extractStatementKey(query: string): string {
  // SQL quotes each identifier separately: FROM "public"."Product" or
  // FROM "Product". Capture the last quoted identifier after FROM/INTO/UPDATE.
  const tableMatch = /\b(?:FROM|INTO|UPDATE)\s+"(?:[^"]+")?\.?"?([^"\s]+)"/i.exec(query);
  if (!tableMatch) return 'other.raw';

  const verbMatch = /^\s*(SELECT|INSERT|UPDATE|DELETE|WITH)/i.exec(query);
  const verb = verbMatch ? verbMatch[1].toLowerCase() : 'raw';
  return `${tableMatch[1].toLowerCase()}.${verb}`;
}

// Mutates (and returns) the stats map, accumulating count/totalMs/maxMs.
export function aggregateQueryTiming(
  stats: QueryTimingStats,
  event: QueryTimingEvent,
): QueryTimingStats {
  const key = extractStatementKey(event.query);
  const stat = stats.get(key) ?? { count: 0, totalMs: 0, maxMs: 0 };

  stat.count += 1;
  stat.totalMs += event.duration;
  stat.maxMs = Math.max(stat.maxMs, event.duration);
  stats.set(key, stat);

  return stats;
}

// Human-readable summary, heaviest statements (by totalMs) first.
export function summarizeQueryTiming(stats: QueryTimingStats): string {
  if (stats.size === 0) return 'No queries recorded.';

  return [...stats.entries()]
    .sort(([, a], [, b]) => b.totalMs - a.totalMs)
    .map(
      ([key, s]) =>
        `${key}: count=${s.count} total=${s.totalMs.toFixed(1)}ms avg=${(s.totalMs / s.count).toFixed(1)}ms max=${s.maxMs.toFixed(1)}ms`,
    )
    .join('\n');
}

// Writes the aggregated stats as JSON to <dir>/query-timing-<label>.json and
// returns the written file path.
export function writeQueryTimingDump(
  stats: QueryTimingStats,
  label: string,
  dir: string = process.cwd(),
): string {
  const payload = Object.fromEntries(
    [...stats.entries()].sort(([, a], [, b]) => b.totalMs - a.totalMs),
  );
  const filePath = join(dir, `query-timing-${label}.json`);
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
  return filePath;
}
