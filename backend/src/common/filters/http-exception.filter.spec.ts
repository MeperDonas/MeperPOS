import {
  BadRequestException,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { HttpExceptionFilter } from './http-exception.filter';
import { PUBLIC_ERROR_CODES } from '../errors/public-error.model';

/** Mock response surface the filter is allowed to touch. */
interface MockResponse {
  status: jest.Mock;
  json: jest.Mock;
}

/**
 * RED baseline for the canonical HTTP error envelope (issue #120, spec
 * requirement: Canonical HTTP Public Error).
 *
 * The filter must serialize EXACTLY `{ code, message, requestId }` on every
 * failure. HTTP status stays transport metadata. Nothing else — no `details`,
 * no `error`, no nested arrays, no raw exception/library text, no `path`,
 * no `timestamp` — may ride on the public payload. Original unexpected
 * diagnostics go only to the protected logger.
 */
describe('HttpExceptionFilter (issue #120 canonical envelope)', () => {
  const SENSITIVE_MARKER = 'SENSITIVE-LEAK-MARKER-7f3a';

  let filter: HttpExceptionFilter;
  let loggerErrorSpy: jest.SpyInstance;

  const buildHost = (
    throwable: unknown,
    overrides: { requestId?: string; method?: string; url?: string } = {},
  ): ArgumentsHost => {
    const request = {
      requestId: overrides.requestId ?? 'req-fixed-123',
      method: overrides.method ?? 'POST',
      url: overrides.url ?? '/api/products',
      headers: {},
    } as unknown as Request;
    const mockResponse: MockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const response = mockResponse as unknown as Response;
    const next: NextFunction = jest.fn();
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
        getNext: () => next,
      }),
      getArgByIndex: () => throwable,
      getArgs: () => [request, response, next],
      getType: () => 'http',
    } as unknown as ArgumentsHost;
  };

  const runFilter = (
    throwable: unknown,
    overrides?: { requestId?: string },
  ) => {
    const host = buildHost(throwable, overrides);
    filter.catch(throwable, host);
    const http = host.switchToHttp();
    const response = http.getResponse<MockResponse>();
    const status = response.status.mock.calls[0]?.[0] as number;
    const body = response.json.mock.calls[0]?.[0];
    return { status, body, response };
  };

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  describe('canonical envelope exclusivity', () => {
    it.each([
      [
        'NotFoundException',
        new Prisma.PrismaClientKnownRequestError('x', {
          code: 'P2025',
          clientVersion: '6.19.2',
        }),
      ],
      ['generic Error', new Error(`${SENSITIVE_MARKER} boom`)],
    ])(
      'serializes exactly { code, message, requestId } for %s',
      (_name, throwable) => {
        const { body } = runFilter(throwable);

        expect(Object.keys(body).sort()).toEqual([
          'code',
          'message',
          'requestId',
        ]);
        expect(typeof body.code).toBe('string');
        expect(body.code.length).toBeGreaterThan(0);
        expect(typeof body.message).toBe('string');
        expect(body.message.length).toBeGreaterThan(0);
        expect(typeof body.requestId).toBe('string');
        expect(body.requestId.length).toBeGreaterThan(0);
      },
    );

    it('carries the request correlation id on the payload', () => {
      const { body } = runFilter(new Error('boom'), { requestId: 'req-42' });
      expect(body.requestId).toBe('req-42');
    });

    it('does not expose details/error/statusCode/path/timestamp or legacy wrapper keys', () => {
      const { body } = runFilter(new Error('boom'));

      expect(body).not.toHaveProperty('details');
      expect(body).not.toHaveProperty('statusCode');
      expect(body).not.toHaveProperty('path');
      expect(body).not.toHaveProperty('timestamp');
      expect(body).not.toHaveProperty('success');
      expect(body).not.toHaveProperty('error');
      expect(body).not.toHaveProperty('stack');
    });

    it('strips unallowlisted exception-response fields (e.g. custom details) from HttpException', () => {
      const exception = new BadRequestException({
        message: 'safe message',
        error: 'Bad Request',
        details: { secret: SENSITIVE_MARKER },
        statusCode: 400,
      });
      const { body } = runFilter(exception);

      expect(Object.keys(body).sort()).toEqual([
        'code',
        'message',
        'requestId',
      ]);
      expect(JSON.stringify(body)).not.toContain(SENSITIVE_MARKER);
    });
  });

  describe('allowlisted mapping', () => {
    it('maps a Prisma P2002 to DUPLICATE_RECORD with a safe message', () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        `Unique constraint failed on the fields: ('sku') ${SENSITIVE_MARKER}`,
        { code: 'P2002', clientVersion: '6.19.2' },
      );
      const { status, body } = runFilter(error);

      expect(status).toBe(HttpStatus.CONFLICT);
      expect(body.code).toBe(PUBLIC_ERROR_CODES.DUPLICATE_RECORD);
      expect(body.message).not.toContain('sku');
      expect(body.message).not.toContain(SENSITIVE_MARKER);
    });

    it('normalizes a validation message array to one deterministic string on the wire', () => {
      const exception = new BadRequestException({
        message: ['name should not be empty', 'sku must be a string'],
        error: 'Bad Request',
      });
      const { status, body } = runFilter(exception);

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.code).toBe(PUBLIC_ERROR_CODES.VALIDATION_ERROR);
      expect(typeof body.message).toBe('string');
      expect(Array.isArray(body.message)).toBe(false);
    });
  });

  describe('protected diagnostics separation', () => {
    it('logs the original unexpected error with stack and context, response stays safe', () => {
      const boom = new Error(
        `${SENSITIVE_MARKER} connection string password=hunter2`,
      );
      boom.stack = `Error: ${SENSITIVE_MARKER}\n    at reallyInternal()`;

      const { status, body } = runFilter(boom);

      // Public payload is a fixed safe summary; marker only on the log.
      expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(body.code).toBe(PUBLIC_ERROR_CODES.INTERNAL_SERVER_ERROR);
      expect(JSON.stringify(body)).not.toContain(SENSITIVE_MARKER);
      expect(JSON.stringify(body)).not.toContain('hunter2');

      expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
      const logged = JSON.stringify(loggerErrorSpy.mock.calls);
      expect(logged).toContain(SENSITIVE_MARKER);
      expect(logged).toContain('reallyInternal');
      expect(logged).toContain('req-fixed-123');
    });

    it('logs non-Error throwables with context without leaking them publicly', () => {
      const { status, body } = runFilter('string-panic');

      expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(JSON.stringify(body)).not.toContain('string-panic');
      expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
    });
  });
});
