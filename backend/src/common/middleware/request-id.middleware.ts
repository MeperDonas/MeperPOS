import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

/**
 * Correlation header + bounded length policy (issue #120).
 *
 * Clients MAY send their own correlation id, but only a valid bounded UUID v4
 * is trusted. Anything else is ignored and replaced with a fresh server UUID,
 * so the value stored on the request and echoed on the response is always
 * bounded and safe to index/log.
 */
export const HEADER_REQUEST_ID = 'x-request-id';
export const REQUEST_ID_LENGTH = 64;
export const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Express request augmented with the resolved correlation id.
 */
export interface RequestWithRequestId extends Request {
  requestId: string;
}

/**
 * Resolve the correlation id for a request:
 * - a valid bounded `x-request-id` UUID v4 is trusted and propagated;
 * - otherwise a fresh `randomUUID()` is generated.
 *
 * Always stores the resolved id on `request.requestId` and echoes it on the
 * response header, then calls `next()` exactly once.
 */
export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const headerValue = request.headers[HEADER_REQUEST_ID];
  const candidate = typeof headerValue === 'string' ? headerValue.trim() : '';

  const requestId = isBoundedUuid(candidate) ? candidate : randomUUID();

  (request as Request & { requestId?: string }).requestId = requestId;
  response.setHeader(HEADER_REQUEST_ID, requestId);
  next();
}

function isBoundedUuid(value: string): boolean {
  return value.length <= REQUEST_ID_LENGTH && UUID_V4.test(value);
}
