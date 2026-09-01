import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { configureApp } from '../app-configuration';

/**
 * Security header verification (issue #48, spec 2.R1).
 *
 * Boots the real AppModule with the exact wiring production applies
 * (configureApp, shared with main.ts) and asserts that helmet's security
 * headers ride on EVERY response — success, 401 and 404 alike.
 *
 * Backend CSP is intentionally disabled (Swagger UI assets conflict with
 * strict policies and this API serves no HTML to end users — see
 * app-configuration.ts), so CSP is deliberately NOT asserted here.
 */

const REQUIRED_HEADERS: Array<{
  header: string;
  expect?: string | RegExp;
}> = [
  { header: 'x-content-type-options', expect: 'nosniff' },
  // helmet's frameguard defaults to SAMEORIGIN; the spec only requires the
  // header family to be present and non-empty.
  { header: 'x-frame-options', expect: /.+/ },
  { header: 'strict-transport-security', expect: /^max-age=\d+/ },
];

function expectSecurityHeaders(res: request.Response): void {
  for (const { header, expect: expected } of REQUIRED_HEADERS) {
    const value = res.headers[header];
    if (expected === undefined) {
      expect(value).toBeDefined();
    } else {
      expect(value).toMatch(expected);
    }
  }
}

describe('Security headers on every backend response (helmet, spec 2.R1)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health (success 2xx) carries the helmet headers', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(200);
    expectSecurityHeaders(res);
  });

  it('GET /api/auth/profile without credentials (401) carries the helmet headers', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/profile');
    expect(res.status).toBe(401);
    expectSecurityHeaders(res);
  });

  it('GET /api/nonexistent-route (404) carries the helmet headers', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/nonexistent-route',
    );
    expect(res.status).toBe(404);
    expectSecurityHeaders(res);
  });
});
