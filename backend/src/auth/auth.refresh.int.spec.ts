import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import {
  setupTwoOrgFixture,
  type TwoOrgFixture,
} from '../testing/two-org-fixture';

/**
 * Refresh-token session integrity (issue #48, spec 3.R1 + amendments 1-2).
 *
 * Real-database integration specs against AuthService: the two-org fixture
 * seeds two organizations and a multi-org member M (org A first-joined, org B
 * selected at login). The refresh flow must preserve the selected org
 * (amendment 1 / design D3.1) and keep concurrent tabs alive with a 60s
 * reuse-grace window (amendment 2 / design D3.2).
 */
describe('AuthService.refresh — org preservation (spec 3.R1, amendment 1)', () => {
  let fixture: TwoOrgFixture;
  let prisma: TwoOrgFixture['prisma'];
  let service: AuthService;
  let jwtService: JwtService;
  let orgAId: string;
  let orgBId: string;
  let multiOrgUserId: string;
  let multiOrgEmail: string;

  const password = 'Refresh-Int-Pass-123!';

  beforeAll(async () => {
    fixture = await setupTwoOrgFixture('refresh-int');
    prisma = fixture.prisma;
    orgAId = fixture.orgAId;
    orgBId = fixture.orgBId;

    jwtService = new JwtService({ secret: 'refresh-int-test-secret' });
    service = new AuthService(prisma as never, jwtService);

    const hashed = await bcrypt.hash(password, 4);
    const user = await prisma.user.create({
      data: {
        email: `refresh-int-multi-${Date.now()}@example.com`,
        password: hashed,
        name: 'Multi Org Member',
        tokenVersion: 0,
        organizationUsers: {
          create: [
            { organizationId: orgAId, role: 'MEMBER', joinedAt: new Date(Date.now() - 60000) },
            { organizationId: orgBId, role: 'MEMBER', joinedAt: new Date() },
          ],
        },
      },
    });
    multiOrgUserId = user.id;
    multiOrgEmail = user.email;
  }, 30000);

  afterAll(async () => {
    await fixture.teardown(async () => {
      await prisma.refreshToken.deleteMany({
        where: { userId: multiOrgUserId },
      });
    });
  });

  function decodeOrg(accessToken: string): string | null {
    const payload = jwtService.verify(accessToken) as {
      organizationId: string | null;
    };
    return payload.organizationId;
  }

  it('login honors the explicitly selected organization (sanity precondition)', async () => {
    const result = await service.login({
      email: multiOrgEmail,
      password,
      organizationId: orgBId,
    });

    expect(decodeOrg(result.accessToken)).toBe(orgBId);
  });

  it('refresh preserves the selected organization (org B stays org B)', async () => {
    const login = await service.login({
      email: multiOrgEmail,
      password,
      organizationId: orgBId,
    });

    const refreshed = await service.refresh(login.refreshToken);

    expect(decodeOrg(refreshed.accessToken)).toBe(orgBId);
  });

  it('refresh of a legacy null-org row falls back to first-joined membership (migration safety)', async () => {
    const raw = crypto.randomBytes(40).toString('hex');
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: { userId: multiOrgUserId, token: hash, expiresAt },
    });

    const refreshed = await service.refresh(raw);

    expect(decodeOrg(refreshed.accessToken)).toBe(orgAId);
  });
});
