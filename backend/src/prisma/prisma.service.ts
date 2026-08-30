import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  aggregateQueryTiming,
  summarizeQueryTiming,
  writeQueryTimingDump,
  type QueryTimingStats,
} from './query-timing';

// Dev-only instrumentation: query timing is captured unless running in
// production or explicitly disabled with PRISMA_QUERY_LOG=0. Zero prod paths.
const QUERY_TIMING_ENABLED =
  process.env.NODE_ENV !== 'production' && process.env.PRISMA_QUERY_LOG !== '0';

// Set PRISMA_QUERY_DUMP=<label> to write backend/query-timing-<label>.json on
// SIGINT (used for before/after evidence, e.g. reports tuning in S5).
const QUERY_DUMP_LABEL = process.env.PRISMA_QUERY_DUMP ?? null;
let sigintDumpInstalled = false;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private queryTimingStats: QueryTimingStats | null = null;
  private queryCount = 0;

  constructor() {
    super(
      QUERY_TIMING_ENABLED
        ? { log: [{ emit: 'event', level: 'query' }] }
        : undefined,
    );

    if (QUERY_TIMING_ENABLED) {
      this.queryTimingStats = new Map();
      this.attachQueryTiming();
    }
  }

  private attachQueryTiming() {
    // The query event type is only exposed by the generated client when the
    // log config is static; the runtime shape is stable, so a narrow local
    // type keeps this dev-only branch decoupled from codegen specifics.
    const client = this as unknown as {
      $on(event: 'query', listener: (event: { query: string; duration: number }) => void): void;
    };

    client.$on('query', (event) => {
      aggregateQueryTiming(this.queryTimingStats!, {
        query: event.query,
        duration: event.duration,
      });
      this.queryCount += 1;

      if (this.queryCount % 500 === 0) {
        console.log(
          `[prisma-timing] ${this.queryCount} queries so far:\n${summarizeQueryTiming(this.queryTimingStats!)}`,
        );
      }
    });

    if (QUERY_DUMP_LABEL && !sigintDumpInstalled) {
      sigintDumpInstalled = true;
      process.on('SIGINT', () => {
        console.log(
          `[prisma-timing] final summary after ${this.queryCount} queries:\n${summarizeQueryTiming(this.queryTimingStats ?? new Map())}`,
        );
        const path = writeQueryTimingDump(
          this.queryTimingStats ?? new Map(),
          QUERY_DUMP_LABEL,
        );
        console.log(`[prisma-timing] dumped query timings to ${path}`);
        // We consumed the SIGINT event, so terminate explicitly (dev only).
        process.exit(0);
      });
    }
  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.log('✅ Database connected successfully');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      console.log('✅ Database disconnected successfully');
    } catch (error) {
      console.error('❌ Error disconnecting from database:', error);
      throw error;
    }
  }
}
