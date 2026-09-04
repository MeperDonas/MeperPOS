import { Logger } from '@nestjs/common';

/**
 * Context describing WHERE an unexpected failure happened. Every field is
 * optional because different boundaries (HTTP route, import parser, import
 * row/job) provide different correlation surfaces. `boundary` names the
 * protected log line so operators can filter by failure site.
 */
export interface DiagnosticContext {
  boundary?: string;
  requestId?: string;
  method?: string;
  path?: string;
  jobId?: string;
  row?: number;
  [key: string]: unknown;
}

const logger = new Logger('ProtectedDiagnostics');

/**
 * Record original unexpected diagnostics in the protected structured log.
 *
 * This is the ONLY sanctioned sink for original throwables, stacks, and raw
 * error text (issue #120, Protected Diagnostics and Correlation). Public
 * payload builders must never serialize these; they route the original here
 * instead. The context line carries boundary/correlation/route/job/row so
 * operators can correlate a public requestId back to the protected detail.
 * The original stack is passed as the log detail so the full diagnostic is
 * retained on the protected side only. Non-Error throwables are stringified
 * safely so the recorder never crashes a request that is already failing.
 */
export function recordProtectedDiagnostic(
  context: DiagnosticContext,
  throwable: unknown,
): void {
  const contextSummary = Object.entries(context)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');

  const detail =
    throwable instanceof Error && throwable.stack
      ? throwable.stack
      : throwable instanceof Error
        ? throwable.message
        : safeStringify(throwable);

  if (contextSummary.length > 0) {
    logger.error(`Unexpected failure [${contextSummary}]`, detail);
  } else {
    logger.error('Unexpected failure', detail);
  }
}

function safeStringify(value: unknown): string {
  try {
    const serialized = JSON.stringify(value);
    return serialized ?? String(value);
  } catch {
    return String(value);
  }
}
