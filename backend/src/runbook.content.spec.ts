import * as fs from 'fs';
import * as path from 'path';

/**
 * Content assertions for docs/secrets-rotation.md (spec 5.R1 + 5.R2, amendment 5).
 *
 * The runbook must be readable (zero mojibake), must state the actual access
 * token TTL (30 minutes since slice C), must describe the real frontend 401
 * behavior (automatic single-flight refresh in frontend/src/lib/api.ts), and
 * must document database and Cloudinary credential rotation (5.R2).
 */

const RUNBOOK_PATH = path.join(__dirname, '..', '..', 'docs', 'secrets-rotation.md');

describe('secrets rotation runbook content', () => {
  let raw: string;

  beforeAll(() => {
    raw = fs.readFileSync(RUNBOOK_PATH, 'utf8');
  });

  it('contains zero mojibake markers (5.R1)', () => {
    // Literal mojibake lead bytes produced by UTF-8 read as Windows-1252, and
    // the Unicode replacement character.
    expect(raw).not.toMatch(/[ÔÃÂ€]/);
    expect(raw).not.toContain('\uFFFD');

    // Truncated token fragments: 'access_token'/'refresh_token' written with
    // their first letter eaten (e.g. "ccess_token", "efresh_token"). Valid
    // full spellings are exempt via negative lookbehind on the real prefix.
    expect(raw).not.toMatch(/(?<![aA])ccess_token/);
    expect(raw).not.toMatch(/(?<![rR])efresh_token/);
  });

  it('does not claim an 8-hour access token TTL (amendment 5: actual TTL is 30 minutes)', () => {
    expect(raw).not.toMatch(/8[\s-]*(?:hours?|h)\b/i);
    // Positive guard: the doc states the shipped 30-minute value.
    expect(raw).toMatch(/30[\s-]*minutes?/i);
  });

  it('describes the real frontend 401 behavior: automatic single-flight silent refresh (5.R1)', () => {
    // The old doc falsely claimed the frontend "does not invoke it
    // automatically on 401". frontend/src/lib/api.ts (response interceptor +
    // refreshSession) performs an automatic, deduplicated (single-flight)
    // refresh and retries the original request.
    expect(raw).not.toMatch(/does not invoke/i);
    expect(raw).toMatch(/automatically/i);
    expect(raw).toMatch(/single-flight/i);
    expect(raw).toMatch(/POST \/api\/auth\/refresh/);
  });

  it('documents database and Cloudinary credential rotation (5.R2)', () => {
    expect(raw).toMatch(/## Database credential rotation/i);
    expect(raw).toMatch(/DATABASE_URL/);
    expect(raw).toMatch(/DIRECT_URL/);
    expect(raw).toMatch(/## Cloudinary credential rotation/i);
    expect(raw).toMatch(/CLOUDINARY_API_SECRET/);
  });
});
