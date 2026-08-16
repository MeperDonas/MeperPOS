import { BillingService } from './billing.service';

describe('BillingService', () => {
  let service: BillingService;

  const prismaMock = {
    organization: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BillingService(prismaMock as never);
  });

  it('returns null when no organizationId is provided', async () => {
    expect(await service.getStatus(undefined)).toBeNull();
    expect(prismaMock.organization.findUnique).not.toHaveBeenCalled();
  });

  it('exposes only the downgradeFlags system key (never other settings)', async () => {
    prismaMock.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      plan: 'PRO',
      status: 'ACTIVE',
      trialEndsAt: null,
      billingStatus: 'PAID',
      settings: {
        printHeader: 'secret header',
        downgradeFlags: { usersOverLimit: true },
        custom: { theme: 'dark' },
      },
    });

    const result = await service.getStatus('org-1');

    expect(result).toEqual({
      id: 'org-1',
      plan: 'PRO',
      status: 'ACTIVE',
      trialEndsAt: null,
      billingStatus: 'PAID',
      settings: { downgradeFlags: { usersOverLimit: true } },
    });
  });

  it('returns empty settings when no system keys are present', async () => {
    prismaMock.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      plan: 'BASIC',
      status: 'ACTIVE',
      trialEndsAt: null,
      billingStatus: 'PENDING',
      settings: { printHeader: 'h' },
    });

    const result = await service.getStatus('org-1');

    expect(result?.settings).toEqual({});
  });
});
