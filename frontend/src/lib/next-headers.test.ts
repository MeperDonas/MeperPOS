// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

/**
 * Security header verification for the Next.js frontend (issue #48, spec 2.R2).
 *
 * Asserts the exact header set that next.config.ts `headers()` applies to
 * every route (`/:path*`). The expected values are hard-coded below on
 * purpose: if someone removes or weakens a header in next.config.ts, this
 * spec fails and blocks merge in CI.
 *
 * The served-route counterpart (production build + `next start`) lives in
 * .github/workflows/ci.yml and checks the same six families on a real
 * response, guarding against build/deploy-time header loss.
 */

interface HeaderEntry {
  key: string;
  value: string;
}

interface HeaderRule {
  source: string;
  headers: HeaderEntry[];
}

const ROUTE_SOURCE = "/:path*";

/** Headers asserted with an exact value (order-insensitive). */
const EXACT_HEADERS: Record<string, string> = {
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

describe("next.config.ts security headers (spec 2.R2)", () => {
  let routeHeaders: HeaderEntry[];

  beforeAll(async () => {
    const rules = (await nextConfig.headers?.()) as HeaderRule[] | undefined;
    expect(rules).toBeDefined();

    const rule = rules!.find((r) => r.source === ROUTE_SOURCE);
    expect(rule).toBeDefined();
    routeHeaders = rule!.headers;
  });

  function valueOf(header: string): string | undefined {
    return routeHeaders.find(
      (h) => h.key.toLowerCase() === header.toLowerCase(),
    )?.value;
  }

  it("applies headers to every route (source /:path*)", () => {
    expect(routeHeaders.length).toBeGreaterThan(0);
  });

  it.each(Object.entries(EXACT_HEADERS))(
    "sets %s to the exact expected value",
    (header, expected) => {
      expect(valueOf(header)).toBe(expected);
    },
  );

  it("sets a non-empty Content-Security-Policy with default-src and frame-ancestors 'none'", () => {
    const csp = valueOf("content-security-policy");
    expect(csp).toBeDefined();
    expect(csp!.length).toBeGreaterThan(0);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
