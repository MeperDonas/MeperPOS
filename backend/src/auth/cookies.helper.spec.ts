import {
  ACCESS_TOKEN_COOKIE,
  CSRF_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  applyAuthCookies,
  buildAuthCookies,
  buildClearedAuthCookies,
  clearAuthCookies,
  generateCsrfToken,
} from './cookies.helper';
import { ACCESS_TOKEN_TTL_MS } from './auth.constants';

describe('cookies.helper', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const tokens = { accessToken: 'access-jwt', refreshToken: 'raw-refresh' };

  const makeRes = () => ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('buildAuthCookies', () => {
    it('uses SameSite=None + Secure in production (cross-site deployment)', () => {
      process.env.NODE_ENV = 'production';

      const cookies = buildAuthCookies(tokens);

      for (const cookie of cookies) {
        expect(cookie.options.sameSite).toBe('none');
        expect(cookie.options.secure).toBe(true);
      }
    });

    it('uses SameSite=Lax without Secure outside production (localhost)', () => {
      process.env.NODE_ENV = 'development';

      const cookies = buildAuthCookies(tokens);

      for (const cookie of cookies) {
        expect(cookie.options.sameSite).toBe('lax');
        expect(cookie.options.secure).toBe(false);
      }
    });

    it('configures access_token httpOnly, site-wide, maxAge mirroring the JWT TTL', () => {
      const access = buildAuthCookies(tokens).find(
        (c) => c.name === ACCESS_TOKEN_COOKIE,
      );

      expect(access).toMatchObject({
        value: tokens.accessToken,
        options: {
          httpOnly: true,
          path: '/',
          maxAge: ACCESS_TOKEN_TTL_MS,
        },
      });
    });

    it('scopes refresh_token to /api/auth with 7d maxAge', () => {
      const refresh = buildAuthCookies(tokens).find(
        (c) => c.name === REFRESH_TOKEN_COOKIE,
      );

      expect(refresh).toMatchObject({
        value: tokens.refreshToken,
        options: {
          httpOnly: true,
          path: '/api/auth',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        },
      });
    });

    it('keeps csrf_token JS-readable and session-scoped', () => {
      const csrf = buildAuthCookies(tokens).find(
        (c) => c.name === CSRF_TOKEN_COOKIE,
      );

      expect(csrf?.options.httpOnly).toBe(false);
      expect(csrf?.options.path).toBe('/');
      expect(csrf?.options.maxAge).toBeUndefined();
      expect(csrf?.value).toHaveLength(64);
    });

    it('reuses an existing csrf token when provided', () => {
      const csrf = buildAuthCookies(tokens, 'existing-csrf').find(
        (c) => c.name === CSRF_TOKEN_COOKIE,
      );

      expect(csrf?.value).toBe('existing-csrf');
    });
  });

  describe('buildClearedAuthCookies', () => {
    it('expires all three cookies keeping the refresh path scoped', () => {
      const cleared = buildClearedAuthCookies();

      expect(cleared.map((c) => c.name)).toEqual([
        ACCESS_TOKEN_COOKIE,
        REFRESH_TOKEN_COOKIE,
        CSRF_TOKEN_COOKIE,
      ]);

      const refresh = cleared.find((c) => c.name === REFRESH_TOKEN_COOKIE);
      expect(refresh?.options.path).toBe('/api/auth');
    });
  });

  describe('applyAuthCookies / clearAuthCookies', () => {
    it('writes every descriptor onto the response', () => {
      process.env.NODE_ENV = 'development';
      const res = makeRes();

      applyAuthCookies(res as never, tokens);

      expect(res.cookie).toHaveBeenCalledTimes(3);
      expect(res.cookie).toHaveBeenCalledWith(
        ACCESS_TOKEN_COOKIE,
        tokens.accessToken,
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('clears every auth cookie on the response', () => {
      const res = makeRes();

      clearAuthCookies(res as never);

      expect(res.clearCookie).toHaveBeenCalledTimes(3);
    });
  });

  describe('generateCsrfToken', () => {
    it('produces unique hex tokens', () => {
      const a = generateCsrfToken();
      const b = generateCsrfToken();

      expect(a).not.toBe(b);
      expect(a).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
