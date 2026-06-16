export type AppRole =
  | "OWNER"
  | "ADMIN"
  | "CASHIER"
  | "INVENTORY_USER"
  | "SUPER_ADMIN";

/**
 * Returns the set of roles a user effectively has, accounting for hierarchy.
 * OWNER inherits ADMIN, CASHIER and INVENTORY_USER permissions.
 * ADMIN inherits CASHIER and INVENTORY_USER permissions.
 */
export function getEffectiveRoles(userRole: AppRole | string): AppRole[] {
  switch (userRole) {
    case "OWNER":
      return ["OWNER", "ADMIN", "CASHIER", "INVENTORY_USER"];
    case "ADMIN":
      return ["ADMIN", "CASHIER", "INVENTORY_USER"];
    case "SUPER_ADMIN":
      return ["SUPER_ADMIN", "ADMIN", "CASHIER", "INVENTORY_USER"];
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
