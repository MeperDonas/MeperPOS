import {
  Logger,
  type CallHandler,
  type ExecutionContext,
} from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { firstValueFrom, of } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import type { RequestUser } from '../interfaces/request-user.interface';

/**
 * Unit matrix for the AuditInterceptor actor/org resolution contract
 * (R-AUDIT-1..4, R-FK-1, R-LOGIN-3, R-LOGIN-5).
 *
 * Fixture URLs MUST be `/api/...` because extractResource capitalizes
 * segments[1]: `/api/auth/login` -> 'Auth', NOT `/auth/login` -> 'Login'.
 *
 * RED baseline (current interceptor reads request.user.sub and writes
 * `userId: user.sub`): the userId/response-user/org-guard cases below fail.
 */
describe('AuditInterceptor — actor/org resolution', () => {
  let interceptor: AuditInterceptor;
  let reflectorGet: jest.Mock;
  const createMock = jest.fn();
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const realUser: RequestUser = {
    userId: 'user-admin-1',
    email: 'admin@example.com',
    organizationId: 'org-1',
    role: OrgRole.ADMIN,
    tokenVersion: 1,
    isSuperAdmin: false,
  };

  const buildRequest = (overrides: Record<string, unknown>) => ({
    method: 'POST',
    url: '/api/products',
    headers: { 'user-agent': 'jest-unit' },
    ip: '127.0.0.1',
    params: {},
    body: {},
    ...overrides,
  });

  const run = async (request: unknown, response: unknown) => {
    const executionContext = {
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of(response) };
    const observable = interceptor.intercept(executionContext, next);
    return firstValueFrom(observable);
  };

  beforeEach(() => {
    createMock.mockReset();
    createMock.mockResolvedValue({ id: 'audit-row-1' });
    reflectorGet = jest.fn().mockReturnValue(undefined);
    interceptor = new AuditInterceptor(
      { auditLog: { create: createMock } } as never,
      { getAllAndOverride: reflectorGet } as never,
    );
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  const expectCreateCalledWith = (expected: Record<string, unknown>) => {
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining(expected),
      }),
    );
  };

  const expectNoCreate = () => expect(createMock).not.toHaveBeenCalled();

  it('persists a row from request.user { userId, organizationId } on an authenticated mutation (R-AUDIT-1/2)', async () => {
    reflectorGet.mockReturnValue('PRODUCT_CREATE');
    const request = buildRequest({ user: realUser });

    const emitted = await run(request, {});

    expect(emitted).toEqual({});
    expectCreateCalledWith({
      userId: 'user-admin-1',
      organizationId: 'org-1',
      action: 'PRODUCT_CREATE',
      resource: 'Products',
    });
  });

  it('extracts resourceId from the response object when present', async () => {
    reflectorGet.mockReturnValue('PRODUCT_CREATE');

    await run(buildRequest({ user: realUser }), { id: 'prod-123' });

    expectCreateCalledWith({ resourceId: 'prod-123' });
  });

  it('never persists when request.user only carries the legacy { sub } shape (R-AUDIT-4)', async () => {
    reflectorGet.mockReturnValue('PRODUCT_CREATE');
    const request = buildRequest({
      user: {
        sub: 'user-admin-1',
        email: 'admin@example.com',
        role: 'ADMIN',
        organizationId: 'org-1',
      },
    });

    const emitted = await run(request, {});

    expect(emitted).toEqual({});
    expectNoCreate();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('legacy sub shape'),
    );
  });

  it('warns and skips when an audited mutation has no request.user (R-AUDIT-1)', async () => {
    reflectorGet.mockReturnValue('PRODUCT_CREATE');

    const emitted = await run(buildRequest({}), {});

    expect(emitted).toEqual({});
    expectNoCreate();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('no authenticated user or response actor'),
    );
  });

  it('persists a LOGIN_SUCCESS row from response.user on /api/auth/login with resource "Auth"', async () => {
    reflectorGet.mockReturnValue('LOGIN_SUCCESS');
    const request = buildRequest({ url: '/api/auth/login' });
    const response = {
      accessToken: 'access-token',
      user: {
        id: 'user-admin-1',
        email: 'admin@example.com',
        name: 'Admin User',
        organizationId: 'org-1',
        role: 'ADMIN',
      },
    };

    const emitted = await run(request, response);

    expect(emitted).toBe(response);
    expectCreateCalledWith({
      userId: 'user-admin-1',
      organizationId: 'org-1',
      action: 'LOGIN_SUCCESS',
      resource: 'Auth',
    });
  });

  it('warns and skips a requiresOrganizationSelection response with no user (R-LOGIN-3)', async () => {
    reflectorGet.mockReturnValue('LOGIN_SUCCESS');
    const request = buildRequest({ url: '/api/auth/login' });
    const response = {
      requiresOrganizationSelection: true,
      preAuthToken: 'pre-auth-token',
      organizations: [{ id: 'org-1' }, { id: 'org-2' }],
    };

    const emitted = await run(request, response);

    expect(emitted).toBe(response);
    expectNoCreate();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('no authenticated user or response actor'),
    );
  });

  it.each(['', null, undefined])(
    'never writes an empty organizationId when request.user org is %p (R-FK-1)',
    async (org) => {
      reflectorGet.mockReturnValue('PRODUCT_CREATE');
      const request = buildRequest({
        user: {
          userId: 'user-admin-1',
          email: 'admin@example.com',
          role: 'ADMIN',
          organizationId: org,
        },
      });

      await run(request, {});

      expectNoCreate();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('organizationId is empty or missing'),
      );
    },
  );

  it('never writes organizationId "" under the legacy { sub } shape (R-AUDIT-4 + R-FK-1)', async () => {
    reflectorGet.mockReturnValue('PRODUCT_CREATE');
    const request = buildRequest({
      user: { sub: 'user-admin-1', organizationId: '' },
    });

    await run(request, {});

    expectNoCreate();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('legacy sub shape'),
    );
  });

  it('warns and skips a superadmin login whose response.user has organizationId null (R-LOGIN-5)', async () => {
    reflectorGet.mockReturnValue('LOGIN_SUCCESS');
    const request = buildRequest({ url: '/api/auth/login' });
    const response = {
      accessToken: 'access-token',
      user: {
        id: 'super-admin-1',
        email: 'super@example.com',
        organizationId: null,
        role: 'SUPER_ADMIN',
      },
    };

    const emitted = await run(request, response);

    expect(emitted).toBe(response);
    expectNoCreate();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('organizationId is empty or missing'),
    );
  });

  it('does not rethrow when auditLog.create throws; logs the error (R-AUDIT-3)', async () => {
    reflectorGet.mockReturnValue('PRODUCT_CREATE');
    createMock.mockRejectedValueOnce(new Error('db down'));
    const response = { id: 'prod-1' };

    const emitted = await run(buildRequest({ user: realUser }), response);
    // Flush the fire-and-forget logAudit continuation (catch/log) microtasks.
    await new Promise((resolve) => setImmediate(resolve));

    expect(emitted).toBe(response);
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to create audit log:',
      expect.any(Error),
    );
  });

  it('passes the response through untouched when no @AuditAction is present', async () => {
    const response = { id: 'prod-1' };

    const emitted = await run(buildRequest({ user: realUser }), response);

    expect(emitted).toBe(response);
    expectNoCreate();
  });
});
