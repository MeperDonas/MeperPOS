import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  classifyPublicError,
  normalizeValidationMessage,
  PUBLIC_ERROR_CODES,
} from './public-error.model';

/**
 * Shape accepted by normalizeValidationMessage — used to type the raw
 * class-validator fixtures below without forcing class-validator's nested
 * ValidationError type into the test.
 */
type ValidationFixture = {
  property?: string;
  constraints?: Record<string, string>;
};

/**
 * RED baseline for the canonical public-error classifier (issue #120, spec
 * requirements: Canonical HTTP Public Error, Safe Exception Classification).
 *
 * These tests pin the allowlist policy: validation arrays collapse to one
 * deterministic string, known Nest HTTP/Prisma cases keep stable actionable
 * codes/messages, and unknown Errors or non-Error throwables collapse to a
 * fixed INTERNAL_SERVER_ERROR summary — the original throwable/stack must
 * NEVER ride in the returned summary.
 */
describe('classifyPublicError (issue #120 canonical public errors)', () => {
  describe('summary shape', () => {
    it('returns exactly status, code, message, and expected (no requestId, no original diagnostics)', () => {
      const summary = classifyPublicError(new Error('boom'));

      expect(Object.keys(summary).sort()).toEqual([
        'code',
        'expected',
        'message',
        'status',
      ]);
    });

    it('returns non-empty string code and message', () => {
      const summary = classifyPublicError(new Error('boom'));

      expect(typeof summary.code).toBe('string');
      expect(summary.code.length).toBeGreaterThan(0);
      expect(typeof summary.message).toBe('string');
      expect(summary.message.length).toBeGreaterThan(0);
    });

    it('never leaks the original exception message for unknown Errors', () => {
      const sensitive = 'ORA-12345 secret connection string password=hunter2';
      const summary = classifyPublicError(new Error(sensitive));

      expect(summary.message).not.toContain('hunter2');
      expect(summary.message).not.toContain('ORA-12345');
      expect(summary.code).toBe(PUBLIC_ERROR_CODES.INTERNAL_SERVER_ERROR);
    });

    it('returns a fixed safe summary for non-Error throwables', () => {
      const summary = classifyPublicError('string panic');

      expect(summary.code).toBe(PUBLIC_ERROR_CODES.INTERNAL_SERVER_ERROR);
      expect(summary.message).not.toContain('string panic');
      expect(summary.expected).toBe(false);
    });
  });

  describe('validation normalization', () => {
    it('flattens a class-validator constraint array into one deterministic string', () => {
      const errors: ValidationFixture[] = [
        {
          property: 'name',
          constraints: { isNotEmpty: 'name should not be empty' },
        },
        {
          property: 'name',
          constraints: { isString: 'name must be a string' },
        },
      ];

      const message = normalizeValidationMessage(errors);

      expect(typeof message).toBe('string');
      expect(message).not.toContain('[object');
      // property/constraint order, deterministic
      expect(message).toBe(
        'name: name should not be empty; name: name must be a string',
      );
    });

    it('produces a deterministic non-empty message for empty constraint sets', () => {
      const message = normalizeValidationMessage([]);

      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });

    it('deduplicates repeated constraint text', () => {
      const errors: ValidationFixture[] = [
        {
          property: 'email',
          constraints: { isEmail: 'email must be an email' },
        },
        {
          property: 'email',
          constraints: { isEmail: 'email must be an email' },
        },
      ];

      const message = normalizeValidationMessage(errors);

      expect(message).toBe('email: email must be an email');
    });

    it('classifies an HttpException carrying a validation array as VALIDATION_ERROR with a single string', () => {
      const exception = new BadRequestException({
        message: ['name should not be empty', 'sku must be a string'],
        error: 'Bad Request',
      });

      const summary = classifyPublicError(exception);

      expect(summary.code).toBe(PUBLIC_ERROR_CODES.VALIDATION_ERROR);
      expect(summary.status).toBe(HttpStatus.BAD_REQUEST);
      expect(summary.expected).toBe(true);
      expect(typeof summary.message).toBe('string');
      expect(summary.message).not.toContain('[object');
    });
  });

  describe('allowlisted HTTP mappings', () => {
    const cases: Array<{
      name: string;
      exception: HttpException;
      code: string;
      status: number;
    }> = [
      {
        name: 'BadRequestException with object response',
        exception: new BadRequestException('bad input'),
        code: PUBLIC_ERROR_CODES.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      },
      {
        name: 'NotFoundException',
        exception: new NotFoundException('Product not found'),
        code: PUBLIC_ERROR_CODES.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      },
      {
        name: 'ConflictException',
        exception: new ConflictException('already exists'),
        code: PUBLIC_ERROR_CODES.CONFLICT,
        status: HttpStatus.CONFLICT,
      },
      {
        name: 'ForbiddenException',
        exception: new ForbiddenException('no access'),
        code: PUBLIC_ERROR_CODES.FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      },
      {
        name: 'UnauthorizedException',
        exception: new UnauthorizedException('sign in'),
        code: PUBLIC_ERROR_CODES.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      },
    ];

    it.each(cases)(
      '$name maps to its allowlisted safe code/message',
      ({ exception, code, status }) => {
        const summary = classifyPublicError(exception);

        expect(summary.code).toBe(code);
        expect(summary.status).toBe(status);
        expect(summary.expected).toBe(true);
        expect(summary.message.length).toBeGreaterThan(0);
        expect(summary.message).not.toContain('at ');
      },
    );

    it('maps a string-response HttpException to its own safe message', () => {
      const exception = new HttpException(
        'plain failure',
        HttpStatus.BAD_GATEWAY,
      );
      const summary = classifyPublicError(exception);

      expect(summary.message).toBe('plain failure');
      expect(summary.status).toBe(HttpStatus.BAD_GATEWAY);
    });
  });

  describe('allowlisted Prisma mappings', () => {
    const buildPrismaError = (
      code: string,
      meta?: Record<string, unknown>,
    ): Prisma.PrismaClientKnownRequestError =>
      new Prisma.PrismaClientKnownRequestError('database raw text', {
        code,
        clientVersion: '6.19.2',
        meta,
      });

    it('maps P2002 unique violation to DUPLICATE_RECORD', () => {
      const summary = classifyPublicError(buildPrismaError('P2002'));

      expect(summary.code).toBe(PUBLIC_ERROR_CODES.DUPLICATE_RECORD);
      expect(summary.status).toBe(HttpStatus.CONFLICT);
      expect(summary.expected).toBe(true);
      expect(summary.message).not.toContain('database raw text');
      expect(summary.message).not.toContain('constraint');
    });

    it('maps P2025 missing record to NOT_FOUND', () => {
      const summary = classifyPublicError(buildPrismaError('P2025'));

      expect(summary.code).toBe(PUBLIC_ERROR_CODES.NOT_FOUND);
      expect(summary.status).toBe(HttpStatus.NOT_FOUND);
      expect(summary.expected).toBe(true);
    });

    it('maps P2003 foreign key violation to FOREIGN_KEY_ERROR', () => {
      const summary = classifyPublicError(buildPrismaError('P2003'));

      expect(summary.code).toBe(PUBLIC_ERROR_CODES.FOREIGN_KEY_ERROR);
      expect(summary.expected).toBe(true);
    });

    it('collapses unknown Prisma codes to a safe unexpected DATABASE_ERROR summary', () => {
      const summary = classifyPublicError(buildPrismaError('P2028'));

      expect(summary.code).toBe(PUBLIC_ERROR_CODES.DATABASE_ERROR);
      expect(summary.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(summary.expected).toBe(false);
      expect(summary.message).not.toContain('database raw text');
    });
  });

  describe('protected diagnostics separation', () => {
    it('marks unknown Errors as unexpected so callers keep the original off the wire', () => {
      const summary = classifyPublicError(new Error('boom'));

      expect(summary.expected).toBe(false);
      expect(summary.code).toBe(PUBLIC_ERROR_CODES.INTERNAL_SERVER_ERROR);
      expect(summary.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
