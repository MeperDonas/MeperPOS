import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { requestIdMiddleware } from './request-id.middleware';
import { HEADER_REQUEST_ID, REQUEST_ID_LENGTH } from './request-id.middleware';

/**
 * RED baseline for request correlation (issue #120, spec requirement:
 * Protected Diagnostics and Correlation).
 *
 * Policy: the middleware accepts a valid bounded UUID v4 from the
 * `x-request-id` header and echoes it on the response; otherwise it generates
 * a fresh randomUUID, stores it on the request, and returns it as the same
 * response header. It must never trust an unbounded/arbitrary client value.
 */
describe('requestIdMiddleware (issue #120 request correlation)', () => {
  const UUID_V4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const buildContext = (headerValue?: string) => {
    const headers: Record<string, string | string[]> = {};
    if (headerValue !== undefined) {
      headers[HEADER_REQUEST_ID] = headerValue;
    }
    const request = { headers } as unknown as Request & {
      requestId?: string;
    };
    const response = {
      setHeader: jest.fn(),
    } as unknown as Response;
    const next: NextFunction = jest.fn();
    return { request, response, next };
  };

  it('generates a bounded requestId when the header is absent', () => {
    const { request, response, next } = buildContext();

    requestIdMiddleware(request, response, next);

    expect(typeof request.requestId).toBe('string');
    expect(request.requestId).toMatch(UUID_V4);
    expect(request.requestId!.length).toBeLessThanOrEqual(REQUEST_ID_LENGTH);
    expect(response.setHeader).toHaveBeenCalledWith(
      HEADER_REQUEST_ID,
      request.requestId,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('propagates a valid bounded client requestId', () => {
    const clientId = randomUUID();
    const { request, response, next } = buildContext(clientId);

    requestIdMiddleware(request, response, next);

    expect(request.requestId).toBe(clientId);
    expect(request.requestId!.length).toBeLessThanOrEqual(REQUEST_ID_LENGTH);
    expect(response.setHeader).toHaveBeenCalledWith(
      HEADER_REQUEST_ID,
      clientId,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('ignores an unbounded or malformed client value and generates its own', () => {
    const malformed = 'a'.repeat(500);
    const { request, response, next } = buildContext(malformed);

    requestIdMiddleware(request, response, next);

    expect(request.requestId).toMatch(UUID_V4);
    expect(request.requestId!.length).toBeLessThanOrEqual(REQUEST_ID_LENGTH);
    expect(request.requestId).not.toBe(malformed);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('always calls next exactly once so the chain proceeds', () => {
    const { request, response, next } = buildContext();

    requestIdMiddleware(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
