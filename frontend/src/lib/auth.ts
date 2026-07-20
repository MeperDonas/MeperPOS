export type AppRole =
  | "OWNER"
  | "ADMIN"
  | "MEMBER"
  | "CASHIER"
  | "INVENTORY_USER"
  | "SUPER_ADMIN";

/**
 * Returns the set of roles a user effectively has, accounting for hierarchy.
 * OWNER inherits ADMIN, MEMBER, CASHIER and INVENTORY_USER permissions.
 * ADMIN inherits MEMBER, CASHIER and INVENTORY_USER permissions.
 * MEMBER inherits CASHIER permissions.
 */
export function getEffectiveRoles(userRole: AppRole | string): AppRole[] {
  switch (userRole) {
    case "OWNER":
      return ["OWNER", "ADMIN", "MEMBER", "CASHIER", "INVENTORY_USER"];
    case "ADMIN":
      return ["ADMIN", "MEMBER", "CASHIER", "INVENTORY_USER"];
    case "SUPER_ADMIN":
      return ["SUPER_ADMIN", "ADMIN", "MEMBER", "CASHIER", "INVENTORY_USER"];
    case "MEMBER":
      return ["MEMBER", "CASHIER"];
    case "CASHIER":
      return ["CASHIER"];
    case "INVENTORY_USER":
      return ["INVENTORY_USER"];
    default:
      return [userRole as AppRole];
  }
}

export function hasAnyRole(
  userRole: AppRole | string | undefined,
  requiredRoles: string[]
): boolean {
  if (!userRole) return false;
  const effective = getEffectiveRoles(userRole);
  return requiredRoles.some((role) => effective.includes(role as AppRole));
}
