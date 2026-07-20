export const PLAN_LIMITS = {
  BASIC: {
    maxUsers: 3,
    maxProducts: 100,
    maxCustomers: 50,
    maxCashRegisters: 1,
    hasForceClose: false,
  },
  PRO: {
    maxUsers: -1,
    maxProducts: -1,
    maxCustomers: -1,
    maxCashRegisters: -1,
    hasForceClose: true,
  },
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;
export type LimitType = 'users' | 'products' | 'customers' | 'cashRegisters';

export interface PlanLimitResult {
  type: LimitType;
  current: number;
  limit: number;
  exceeded: boolean;
  warningAt: number; // 80%
}
