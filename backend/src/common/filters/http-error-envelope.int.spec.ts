import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpStatus,
  INestApplication,
  Logger,
  NotFoundException,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsNotEmpty, IsString } from 'class-validator';
import request from 'supertest';
import { configureApp, configureErrorHandling } from '../../app-configuration';
import { PUBLIC_ERROR_CODES } from '../errors/public-error.model';
import { HEADER_REQUEST_ID } from '../middleware/request-id.middleware';

/**
 * Full-stack wiring evidence for the canonical HTTP error envelope
 * (issue #120, spec: Canonical HTTP Public Error + Evidence).
 *
 * Boots a minimal controller through the EXACT production error boundary:
 * request-ID middleware, real ValidationPipe, and the global
 * HttpExceptionFilter (all registered by `configureErrorHandling`, shared
 * with main.ts). Proves end-to-end that:
 *  - a validation failure returns a deterministic single string, VALIDATION_ERROR,
 *    and a correlated requestId echoed as the x-request-id header;
 *  - known HTTP errors map to stable codes/messages with no legacy wrapper;
 *  - an unexpected thrown Error collapses to a fixed safe summary and the
 *    sensitive original stays off the wire;
 *  - a valid client x-request-id is honored, a malformed one is replaced.
 */

class SampleBodyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

@Controller('error-probe')
class ErrorProbeController {
  @Post('validate')
  create(@Body() _dto: SampleBodyDto): { ok: true } {
    return { ok: true };
  }

  @Get('not-found')
  notFound(): never {
    throw new NotFoundException('Sample record missing');
  }

  @Get('conflict')
  conflict(): never {
    throw new ConflictException();
  }

  @Get('crash')
  crash(): never {
    throw new Error('BOOM-SENSITIVE-MARKER-9911 leaked connection secret');
  }
}

describe('HTTP error envelope over the wire (issue #120)', () => {
  let app: INestApplication;
  let loggerErrorSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ErrorProbeController],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    configureErrorHandling(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    loggerWarnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
    loggerWarnSpy.mockRestore();
  });

  const UUID_V4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it('returns exactly {code,message,requestId} for a validation failure with a correlated header', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/error-probe/validate')
      .send({ name: '' });

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(Object.keys(res.body).sort()).toEqual([
      'code',
      'message',
      'requestId',
    ]);
    expect(res.body.code).toBe(PUBLIC_ERROR_CODES.VALIDATION_ERROR);
    expect(typeof res.body.message).toBe('string');
    expect(Array.isArray(res.body.message)).toBe(false);
    expect(res.body.message.length).toBeGreaterThan(0);
    expect(res.body.requestId).toMatch(UUID_V4);
    expect(res.headers[HEADER_REQUEST_ID]).toBe(res.body.requestId);
  });

  it('maps a known NotFoundException to NOT_FOUND with only the envelope', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/error-probe/not-found',
    );

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    expect(res.body).toEqual({
      code: PUBLIC_ERROR_CODES.NOT_FOUND,
      message: 'Sample record missing',
      requestId: res.body.requestId,
    });
    expect(Object.keys(res.body).sort()).toEqual([
      'code',
      'message',
      'requestId',
    ]);
  });

  it('collapses an unexpected Error to a fixed safe summary and never leaks the marker', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/error-probe/crash',
    );

    expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(res.body.code).toBe(PUBLIC_ERROR_CODES.INTERNAL_SERVER_ERROR);
    expect(JSON.stringify(res.body)).not.toContain('BOOM-SENSITIVE-MARKER');
    expect(JSON.stringify(res.body)).not.toContain('connection secret');
    expect(Object.keys(res.body).sort()).toEqual([
      'code',
      'message',
      'requestId',
    ]);
    expect(res.headers[HEADER_REQUEST_ID]).toBe(res.body.requestId);
  });

  it('honors a valid bounded client x-request-id', async () => {
    const clientId = '11111111-1111-4111-8111-111111111111';
    const res = await request(app.getHttpServer())
      .get('/api/error-probe/conflict')
      .set(HEADER_REQUEST_ID, clientId);

    expect(res.status).toBe(HttpStatus.CONFLICT);
    expect(res.body.requestId).toBe(clientId);
    expect(res.headers[HEADER_REQUEST_ID]).toBe(clientId);
  });

  it('replaces a malformed unbounded client x-request-id with a bounded UUID', async () => {
    const malformed = 'a'.repeat(500);
    const res = await request(app.getHttpServer())
      .get('/api/error-probe/conflict')
      .set(HEADER_REQUEST_ID, malformed);

    expect(res.body.requestId).toMatch(UUID_V4);
    expect(res.body.requestId.length).toBeLessThanOrEqual(64);
    expect(res.body.requestId).not.toBe(malformed);
    expect(res.headers[HEADER_REQUEST_ID]).toBe(res.body.requestId);
  });
});
