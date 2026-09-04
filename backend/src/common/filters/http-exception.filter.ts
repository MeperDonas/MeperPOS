import { ExceptionFilter, Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import {
  classifyPublicError,
  toPublicError,
  type PublicError,
} from '../errors/public-error.model';
import { recordProtectedDiagnostic } from '../errors/protected-diagnostics';
import type { RequestWithRequestId } from '../middleware/request-id.middleware';

/**
 * Global exception filter for the canonical public error envelope
 * (issue #120, spec: Canonical HTTP Public Error).
 *
 * Every application-generated HTTP error serializes EXACTLY
 * `{ code, message, requestId }`; the HTTP status remains transport
 * metadata on the response line. Known, user-correctable failures
 * (validation, duplicates, not-found, auth) keep actionable safe messages.
 * Unknown errors and non-Error throwables collapse to a fixed safe summary
 * while the ORIGINAL throwable, stack, and request context are recorded only
 * in protected structured logs via `recordProtectedDiagnostic`.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const summary = classifyPublicError(exception);

    const requestId =
      (request as Partial<RequestWithRequestId>).requestId ?? 'unknown';

    // Unexpected failures keep the original diagnostics OUT of the public
    // payload and INSIDE the protected structured log only.
    if (!summary.expected) {
      recordProtectedDiagnostic(
        {
          boundary: 'http',
          requestId,
          method: request.method,
          path: request.url,
        },
        exception,
      );
    } else {
      // Expected failures still deserve a log line, but never with raw
      // diagnostic text beyond the safe public message.
      this.logger.warn(
        `${request.method} ${request.url} - Status: ${summary.status} - Code: ${summary.code} - Message: ${summary.message}`,
      );
    }

    const publicError: PublicError = toPublicError(summary, requestId);
    response.status(summary.status).json(publicError);
  }
}
