import { HttpException, HttpStatus } from '@nestjs/common';
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/library';

/**
 * Canonical public error codes exposed by the API (issue #120).
 *
 * These codes are part of the public contract: clients may branch on them.
 * They carry no diagnostic detail by themselves.
 */
export const PUBLIC_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DUPLICATE_RECORD: 'DUPLICATE_RECORD',
  FOREIGN_KEY_ERROR: 'FOREIGN_KEY_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  IMPORT_PARSE_FAILED: 'IMPORT_PARSE_FAILED',
  IMPORT_ROW_FAILED: 'IMPORT_ROW_FAILED',
  IMPORT_JOB_FAILED: 'IMPORT_JOB_FAILED',
} as const;

export type PublicErrorCode =
  (typeof PUBLIC_ERROR_CODES)[keyof typeof PUBLIC_ERROR_CODES];

/**
 * Wire envelope for every application-generated HTTP error. This is the
 * ONLY shape clients may rely on: `code`, `message`, and `requestId` that
 * correlates the failure to protected logs.
 */
export interface PublicError {
  code: string;
  message: string;
  requestId: string;
}

/**
 * Classifier output: what the boundary should send/log for a throwable.
 * `status` is transport metadata (HTTP status); `expected` tells callers
 * whether this is a known, user-correctable failure (false => the original
 * diagnostic must be recorded in protected logs only).
 */
export interface PublicErrorSummary {
  status: number;
  code: string;
  message: string;
  expected: boolean;
}

export interface PublicImportIssue {
  row?: number;
  field?: string;
  code: string;
  message: string;
  correlationId: string;
}

export const PUBLIC_IMPORT_MESSAGES = {
  PARSE_FAILED: 'The import file could not be processed',
  ROW_FAILED: 'The row could not be imported',
  JOB_FAILED: 'The import could not be completed',
} as const;

const FIXED_UNEXPECTED_MESSAGE = 'An unexpected error occurred';
const FIXED_DATABASE_MESSAGE = 'A database error occurred';

/** Messages that never leak into public payloads regardless of origin. */
const INTERNAL_FALLBACK_MESSAGE = 'Internal server error';

/**
 * Deterministic, safe message for a class-validator failure array.
 *
 * class-validator (via Nest's ValidationPipe) produces an array of flattened
 * messages. We fold them in property/constraint order, trim whitespace,
 * deduplicate, and join into a single string. Empty output falls back to a
 * fixed actionable validation message.
 */
export function normalizeValidationMessage(
  validationErrors: Array<{
    property?: string;
    constraints?: Record<string, string> | undefined;
  }>,
): string {
  const parts: string[] = [];

  for (const error of validationErrors) {
    const property = error.property ?? '';
    const constraints = error.constraints ?? {};
    const keys = Object.keys(constraints).sort();
    for (const key of keys) {
      const text = (constraints[key] ?? '').trim();
      if (!text) {
        continue;
      }
      const prefix = property ? `${property}: ` : '';
      parts.push(`${prefix}${text}`);
    }
  }

  const unique = Array.from(new Set(parts));
  if (unique.length === 0) {
    return 'Request validation failed';
  }
  return unique.join('; ');
}

/**
 * Pure allowlist classifier (issue #120, Safe Exception Classification).
 *
 * Maps known Nest HTTP exceptions, Prisma client errors, and validation
 * arrays to stable safe summaries. Unknown `Error` instances and non-Error
 * throwables collapse to a fixed `INTERNAL_SERVER_ERROR` summary whose
 * `expected:false` flag instructs the boundary to record the ORIGINAL
 * throwable in protected logs only.
 */
export function classifyPublicError(exception: unknown): PublicErrorSummary {
  if (exception instanceof PrismaClientKnownRequestError) {
    return classifyPrismaError(exception);
  }

  if (exception instanceof PrismaClientValidationError) {
    return {
      status: HttpStatus.BAD_REQUEST,
      code: PUBLIC_ERROR_CODES.VALIDATION_ERROR,
      message: 'Request data is invalid',
      expected: true,
    };
  }

  if (exception instanceof HttpException) {
    return classifyHttpException(exception);
  }

  // Unknown Error or non-Error throwable: fixed safe summary, unexpected.
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: PUBLIC_ERROR_CODES.INTERNAL_SERVER_ERROR,
    message: INTERNAL_FALLBACK_MESSAGE,
    expected: false,
  };
}

function classifyPrismaError(
  exception: PrismaClientKnownRequestError,
): PublicErrorSummary {
  switch (exception.code) {
    case 'P2002':
      return {
        status: HttpStatus.CONFLICT,
        code: PUBLIC_ERROR_CODES.DUPLICATE_RECORD,
        message: 'A record with the same unique value already exists',
        expected: true,
      };
    case 'P2025':
      return {
        status: HttpStatus.NOT_FOUND,
        code: PUBLIC_ERROR_CODES.NOT_FOUND,
        message: 'The requested record was not found',
        expected: true,
      };
    case 'P2003':
      return {
        status: HttpStatus.BAD_REQUEST,
        code: PUBLIC_ERROR_CODES.FOREIGN_KEY_ERROR,
        message: 'The request references a record that does not exist',
        expected: true,
      };
    default:
      // Known database-failure family, but not a user-correctable one.
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: PUBLIC_ERROR_CODES.DATABASE_ERROR,
        message: FIXED_DATABASE_MESSAGE,
        expected: false,
      };
  }
}

/**
 * Extract the message payload from a Nest `HttpException`.
 *
 * Nest's `getResponse()` returns either a string or an object. An object may
 * carry a flat `message` string, an array of messages (class-validator), or a
 * fully custom body. Only string and array-of-strings message forms are safe
 * to forward; everything else (nested details, error objects) is dropped.
 */
function extractHttpMessage(
  response: string | Record<string, unknown>,
): { message: string; kind: 'validation' | 'http' } | undefined {
  if (typeof response === 'string') {
    return { message: response, kind: 'http' };
  }

  const message = response.message;

  if (Array.isArray(message)) {
    const flat = message
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    if (flat.length > 0) {
      return { message: flat.join('; '), kind: 'validation' };
    }
    return { message: 'Request validation failed', kind: 'validation' };
  }

  if (typeof message === 'string' && message.trim()) {
    return { message: message.trim(), kind: 'http' };
  }

  return undefined;
}

/**
 * Allowlisted codes a Nest `HttpException` response body may self-declare via
 * an explicit `code` field. Exception bodies are NOT trusted sources of
 * arbitrary detail — only these stable public codes are honored, and only for
 * expected (user-correctable) HTTP failures. This is what the ValidationPipe
 * factory uses to tag validation failures without leaking the raw constraint
 * array structure onto the wire.
 */
const ALLOWED_SELF_DECLARED_CODES: ReadonlySet<string> = new Set([
  PUBLIC_ERROR_CODES.VALIDATION_ERROR,
]);

function classifyHttpException(exception: HttpException): PublicErrorSummary {
  const status = exception.getStatus();
  const response = exception.getResponse() as string | Record<string, unknown>;

  const extracted = extractHttpMessage(response);

  const body = response as Record<string, unknown>;
  const declaredCode = typeof body.code === 'string' ? body.code : undefined;
  const isValidationArray = Array.isArray(body.message);

  if (extracted) {
    // Prefer the allowlisted self-declared code (e.g. our ValidationPipe
    // factory tags VALIDATION_ERROR); fall back to the array shape, then to
    // the status-derived code. Only allowlisted codes are honored.
    let code: string;
    if (
      declaredCode &&
      ALLOWED_SELF_DECLARED_CODES.has(declaredCode) &&
      !isValidationArray
    ) {
      code = declaredCode;
    } else if (isValidationArray) {
      code = PUBLIC_ERROR_CODES.VALIDATION_ERROR;
    } else {
      code = codeForHttpStatus(status);
    }

    return {
      status,
      code,
      message: extracted.message,
      expected: true,
    };
  }

  // Unrecognized exception-response body (nested details, custom error
  // objects): never forward it. Return a safe code/message derived only from
  // the status, keeping the payload schema-exclusive.
  return {
    status,
    code: codeForHttpStatus(status),
    message: messageForHttpStatus(status),
    expected: status < 500,
  };
}

/**
 * Canonical public code for a known HTTP status. Lookup table (indexing, not
 * comparison) keeps numeric-enum values safe under the repo lint rules. 4xx
 * map to actionable codes; anything else falls back to INTERNAL_SERVER_ERROR.
 */
const PUBLIC_CODE_BY_HTTP_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: PUBLIC_ERROR_CODES.BAD_REQUEST,
  [HttpStatus.UNAUTHORIZED]: PUBLIC_ERROR_CODES.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: PUBLIC_ERROR_CODES.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: PUBLIC_ERROR_CODES.NOT_FOUND,
  [HttpStatus.CONFLICT]: PUBLIC_ERROR_CODES.CONFLICT,
  [HttpStatus.UNPROCESSABLE_ENTITY]: PUBLIC_ERROR_CODES.VALIDATION_ERROR,
};

/**
 * Safe public message for a known HTTP status with no user-safe body to
 * forward. Lookup table for the same reason as above.
 */
const MESSAGE_BY_HTTP_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'The request is invalid',
  [HttpStatus.UNAUTHORIZED]: 'Authentication is required',
  [HttpStatus.FORBIDDEN]: 'You do not have permission to perform this action',
  [HttpStatus.NOT_FOUND]: 'The requested resource was not found',
  [HttpStatus.CONFLICT]: 'The request conflicts with the current state',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Request validation failed',
};

export function codeForHttpStatus(status: number): string {
  return (
    PUBLIC_CODE_BY_HTTP_STATUS[status] ??
    PUBLIC_ERROR_CODES.INTERNAL_SERVER_ERROR
  );
}

function messageForHttpStatus(status: number): string {
  return MESSAGE_BY_HTTP_STATUS[status] ?? FIXED_UNEXPECTED_MESSAGE;
}

/**
 * Build the public wire envelope from a classifier summary + correlation id.
 * This is the ONLY function authorized to assemble the client-facing shape.
 */
export function toPublicError(
  summary: PublicErrorSummary,
  requestId: string,
): PublicError {
  return {
    code: summary.code,
    message: summary.message,
    requestId,
  };
}
